import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Edit, Trash2, Plus, Search, Filter, File } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const TemplateManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [templates, setTemplates] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to fetch templates",
        variant: "destructive"
      });
    }
  };

  const categories = ["All", "Discovery", "Client Communication", "Motions", "Negotiation", "Pleadings", "Uploaded"];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ['.docx', '.doc', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a .docx, .doc, or .txt file",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('templates')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get user's firm_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('firm_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.firm_id) {
        throw new Error('User must be associated with a firm to upload templates');
      }

      // Create template record
      const { error: insertError } = await supabase
        .from('templates')
        .insert({
          name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
          category: 'Uploaded',
          file_path: filePath,
          file_type: fileExtension === '.txt' ? 'text' : 'docx',
          content: null, // Will be extracted when needed
          created_by: user.id,
          firm_id: profile.firm_id
        });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Template uploaded successfully"
      });
      
      fetchTemplates();
    } catch (error) {
      console.error('Error uploading template:', error);
      toast({
        title: "Error",
        description: "Failed to upload template",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleEdit = (templateId: string) => {
    toast({
      title: "Coming Soon",
      description: "Template editing will be available soon"
    });
  };

  const handleDelete = async (templateId: string) => {
    try {
      const template = templates.find(t => t.id === templateId);
      if (template?.file_path) {
        await supabase.storage.from('templates').remove([template.file_path]);
      }
      
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template deleted successfully"
      });
      
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/70 border-steel-blue-200">
        <CardHeader>
          <CardTitle className="text-steel-blue-800 flex items-center justify-between">
            <span className="flex items-center">
              <FileText className="mr-2 h-5 w-5 text-steel-blue-600" />
              Template Library
            </span>
            <div className="relative">
              <input
                type="file"
                accept=".docx,.doc,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />
              <Button disabled={isUploading} className="bg-primary hover:bg-primary/90">
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? 'Uploading...' : 'Upload Template'}
              </Button>
            </div>
          </CardTitle>
          <CardDescription className="text-steel-blue-600">
            Manage your firm's document templates for AI generation - supports .docx, .doc, and .txt files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-steel-blue-500" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search templates..."
                  className="pl-10 border-steel-blue-300 focus:border-primary"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="border-steel-blue-300">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.slice(1).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between p-4 border border-steel-blue-200 rounded-lg hover:bg-steel-blue-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  {template.file_type === 'docx' ? 
                    <File className="h-8 w-8 text-blue-500" /> : 
                    <FileText className="h-8 w-8 text-steel-blue-500" />
                  }
                  <div>
                    <h3 className="font-medium text-steel-blue-800">{template.name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="secondary" className="bg-steel-blue-100 text-steel-blue-700">
                        {template.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {template.file_type?.toUpperCase() || 'TEXT'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right text-sm text-steel-blue-600">
                    <div>{template.file_type === 'docx' ? 'Word Document' : 'Text File'}</div>
                    <div>Created {new Date(template.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(template.id)}
                      className="border-steel-blue-300 hover:bg-steel-blue-50"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      className="border-red-300 hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-steel-blue-400 mx-auto mb-4" />
              <p className="text-steel-blue-600">No templates found matching your criteria.</p>
              <div className="relative inline-block mt-4">
                <input
                  type="file"
                  accept=".docx,.doc,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <Button variant="outline" className="border-steel-blue-300" disabled={isUploading}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploading ? 'Uploading...' : 'Upload Template'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/70 border-steel-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-steel-blue-800">Template Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-steel-blue-600">Total Templates</span>
                <span className="font-medium text-steel-blue-800">{templates.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-steel-blue-600">Word Documents</span>
                <span className="font-medium text-blue-600">
                  {templates.filter(t => t.file_type === 'docx').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-steel-blue-600">Text Files</span>
                <span className="font-medium text-green-600">
                  {templates.filter(t => t.file_type === 'text').length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 border-steel-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-steel-blue-800">Recent Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {templates
                .slice(0, 3)
                .map((template, index) => (
                  <div key={template.id} className="flex justify-between">
                    <span className="text-steel-blue-600 truncate flex items-center">
                      {template.file_type === 'docx' ? 
                        <File className="h-3 w-3 mr-1 text-blue-500" /> : 
                        <FileText className="h-3 w-3 mr-1" />
                      }
                      {template.name.slice(0, 20)}...
                    </span>
                    <span className="text-xs text-steel-blue-500">
                      {template.file_type?.toUpperCase()}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 border-steel-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-steel-blue-800">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="file"
                  accept=".docx,.doc,.txt"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <Button variant="outline" className="w-full justify-start border-steel-blue-300" disabled={isUploading}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload New Template
                </Button>
              </div>
              <Button variant="outline" className="w-full justify-start border-steel-blue-300">
                <Plus className="mr-2 h-4 w-4" />
                Create Text Template
              </Button>
              <Button variant="outline" className="w-full justify-start border-steel-blue-300">
                <Filter className="mr-2 h-4 w-4" />
                Manage Categories
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TemplateManager;