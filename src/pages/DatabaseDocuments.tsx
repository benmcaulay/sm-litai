import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Folder, File, Trash2, Edit, Tag, ArrowLeft, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DbDoc {
  id: string;
  storage_path: string;
  filename: string;
  size_bytes: number;
  mime_type: string | null;
  tags: string[];
  created_at: string;
}

interface CaseFolder {
  id: string;
  name: string;
  created_at: string;
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const DatabaseDocuments = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [docs, setDocs] = useState<DbDoc[]>([]);
  const [folders, setFolders] = useState<CaseFolder[]>([]);
  const [dbInfo, setDbInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [prefix, setPrefix] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [tagEdit, setTagEdit] = useState<{[id:string]: string}>({});
  const { toast } = useToast();

  useEffect(() => {
    document.title = dbInfo?.name ? `${dbInfo.name} Documents – LitAI` : 'Database Documents – LitAI';
  }, [dbInfo?.name]);

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    const load = async () => {
      setLoading(true);
      try {
        const [dbRes, docsRes, casesRes] = await Promise.all([
          supabase.from('external_databases').select('id, name, type, status, created_by, firm_id').eq('id', id).maybeSingle(),
          (supabase as any).from('database_documents').select('*').eq('external_database_id', id).order('created_at', { ascending: false }),
          (supabase as any).from('case_files').select('id, name, created_at').order('created_at', { ascending: true })
        ]);
        const { data: db, error: dbErr } = dbRes as any;
        const { data, error } = docsRes as any;
        const { data: cases, error: casesErr } = casesRes as any;
        if (dbErr) console.warn(dbErr);
        setDbInfo(db);
        if (error) console.warn(error);
        setDocs((data || []) as any);
        if (casesErr) console.warn(casesErr);
        setFolders((cases || []) as any);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, profile?.role]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const p = prefix;
    const inCurrentView = (d: DbDoc) => {
      const inAnyCase = d.storage_path.includes('/cases/');
      if (currentFolderId) return d.storage_path.includes(`/cases/${currentFolderId}/`);
      return !inAnyCase; // root view shows only files not inside any case folder
    };
    return docs.filter(d =>
      inCurrentView(d) &&
      (!s || d.filename.toLowerCase().includes(s) || d.storage_path.toLowerCase().includes(s)) &&
      (!p || d.storage_path.startsWith(p))
    );
  }, [docs, search, prefix, currentFolderId]);

  const handleDelete = async (doc: DbDoc) => {
    if (!confirm(`Delete ${doc.filename}? This cannot be undone.`)) return;
    const { error: delErr } = await supabase.storage.from('database-uploads').remove([doc.storage_path]);
    if (delErr) {
      alert(delErr.message);
      return;
    }
    const { error } = await (supabase as any).from('database_documents').delete().eq('id', doc.id);
    if (error) alert(error.message);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  const handleRenameMove = async (doc: DbDoc) => {
    const newPath = prompt('Enter new path (including filename):', doc.storage_path) || doc.storage_path;
    if (newPath === doc.storage_path) return;
    const { error: mvErr } = await supabase.storage.from('database-uploads').move(doc.storage_path, newPath);
    if (mvErr) {
      alert(mvErr.message);
      return;
    }
    const newName = newPath.split('/').pop() || doc.filename;
    const { error } = await (supabase as any).from('database_documents').update({ storage_path: newPath, filename: newName }).eq('id', doc.id);
    if (error) alert(error.message);
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, storage_path: newPath, filename: newName } : d));
  };

  const handleAddTag = async (doc: DbDoc) => {
    const val = (tagEdit[doc.id] || '').trim();
    if (!val) return;
    const next = Array.from(new Set([...(doc.tags || []), val]));
    const { error } = await (supabase as any).from('database_documents').update({ tags: next }).eq('id', doc.id);
    if (!error) {
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, tags: next } : d));
      setTagEdit(prev => ({ ...prev, [doc.id]: '' }));
    }
  };

  const handleRemoveTag = async (doc: DbDoc, t: string) => {
    const next = (doc.tags || []).filter(x => x !== t);
    const { error } = await (supabase as any).from('database_documents').update({ tags: next }).eq('id', doc.id);
    if (!error) setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, tags: next } : d));
  };

  const handleDropOnFolder = async (folder: CaseFolder, doc: DbDoc) => {
    const fileUserId = (doc.storage_path || '').split('/')[0] || (user?.id || '');
    const newPath = `${fileUserId}/cases/${folder.id}/${doc.filename}`;
    if (newPath === doc.storage_path) return;
    try {
      const { error: mvErr } = await supabase.storage.from('database-uploads').move(doc.storage_path, newPath);
      if (mvErr) {
        toast({ title: 'Move failed', description: mvErr.message, variant: 'destructive' });
        return;
      }
      const { error } = await (supabase as any).from('database_documents').update({ storage_path: newPath }).eq('id', doc.id);
      if (error) {
        toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      }
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, storage_path: newPath } : d));
      toast({ title: 'Moved', description: `Moved to case: ${folder.name}` });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Could not move file', variant: 'destructive' });
    }
  };

  const handleCreateCaseFolder = async () => {
    const name = prompt('New case name:')?.trim();
    if (!name) return;
    try {
      const { data: inserted, error } = await (supabase as any)
        .from('case_files')
        .insert({ name, firm_id: profile?.firm_id, created_by: user?.id, source: 'database', status: 'indexed' })
        .select('id, name')
        .maybeSingle();
      if (error || !inserted) throw error || new Error('Failed to create case');
      const keepPath = `${user?.id}/cases/${inserted.id}/.keep`;
      const { error: upErr } = await supabase.storage
        .from('database-uploads')
        .upload(keepPath, new Blob(["case folder"]), { contentType: 'text/plain', upsert: true });
      if (upErr) console.warn('Placeholder upload failed:', upErr.message);
      toast({ title: 'Case created', description: `Folder ready: cases/${inserted.id}` });
      setFolders((prev) => [...prev, { id: inserted.id, name: inserted.name, created_at: new Date().toISOString() } as CaseFolder]);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Could not create case', variant: 'destructive' });
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-steel-blue-50 to-steel-blue-100">
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-white/70 border-steel-blue-200">
            <CardHeader>
              <CardTitle className="text-steel-blue-800">Access denied</CardTitle>
              <CardDescription className="text-steel-blue-600">Admins only</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-steel-blue-50 to-steel-blue-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" className="border-steel-blue-300" onClick={() => navigate('/')}> 
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          {currentFolderId && (
            <Button variant="outline" className="border-steel-blue-300" onClick={() => setCurrentFolderId(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Folders
            </Button>
          )}
          <h1 className="text-3xl font-bold text-steel-blue-800">
            {dbInfo?.name || 'Database'} Documents {currentFolderId ? `› Case: ${folders.find(f => f.id === currentFolderId)?.name || ''}` : ''}
          </h1>
        </div>
        <Card className="bg-white/70 border-steel-blue-200">
          <CardHeader>
            <CardTitle className="text-steel-blue-800">Browse and organize</CardTitle>
            <CardDescription className="text-steel-blue-600">Rename, move, tag, and delete files</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-4 justify-between">
              <div className="flex-1 flex flex-col md:flex-row gap-3">
                <Input placeholder="Search by name or path" value={search} onChange={(e)=>setSearch(e.target.value)} className="border-steel-blue-300" />
                <Input placeholder="Folder prefix (e.g. userId/cases/CASE_ID)" value={prefix} onChange={(e)=>setPrefix(e.target.value)} className="border-steel-blue-300" />
              </div>
              <Button onClick={handleCreateCaseFolder} variant="outline" className="border-steel-blue-300">
                <Plus className="h-4 w-4 mr-2" /> New Case Folder (Admin)
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {!currentFolderId && folders.map((f) => (
                    <TableRow
                      key={`folder-${f.id}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const draggedId = e.dataTransfer.getData('text/dbdoc-id');
                        const doc = docs.find((d) => d.id === draggedId);
                        if (doc) handleDropOnFolder(f, doc);
                      }}
                      onClick={() => setCurrentFolderId(f.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium flex items-center gap-2">
                        <Folder className="h-4 w-4 text-steel-blue-600" /> {f.name}
                      </TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="text-sm text-steel-blue-700">cases/{f.id}/</TableCell>
                      <TableCell>
                        <div className="text-sm text-steel-blue-600">Drop files here or click to open</div>
                      </TableCell>
                      <TableCell className="text-right"></TableCell>
                    </TableRow>
                  ))}
                  {filtered.map((d) => (
                    <TableRow key={d.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/dbdoc-id', d.id)}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <File className="h-4 w-4 text-steel-blue-600" /> {d.filename}
                      </TableCell>
                      <TableCell>{formatBytes(d.size_bytes)}</TableCell>
                      <TableCell className="text-sm text-steel-blue-700">{d.storage_path}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2 items-center">
                          {(d.tags || []).map(t => (
                            <Badge key={t} variant="secondary" className="bg-steel-blue-100 text-steel-blue-700 cursor-pointer" onClick={()=>handleRemoveTag(d,t)}>
                              <Tag className="h-3 w-3 mr-1" /> {t} ×
                            </Badge>
                          ))}
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Add tag"
                              value={tagEdit[d.id] || ''}
                              onChange={(e)=>setTagEdit(prev=>({...prev,[d.id]:e.target.value}))}
                              className="h-8 w-28 border-steel-blue-300"
                            />
                            <Button size="sm" variant="outline" className="h-8 border-steel-blue-300" onClick={()=>handleAddTag(d)}>Add</Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" className="border-steel-blue-300" onClick={()=>handleRenameMove(d)}>
                          <Edit className="h-4 w-4 mr-1" /> Rename/Move
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={()=>handleDelete(d)}>
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-steel-blue-600">No documents here.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DatabaseDocuments;
