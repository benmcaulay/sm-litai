
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Edit, Trash2, Plus, Search, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const TemplateManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { toast } = useToast();

  const templates = [
    {
      id: 1,
      name: "Deposition Summary Template",
      category: "Discovery",
      lastModified: "2024-01-15",
      size: "2.4 KB",
      usage: 45,
      status: "active"
    },
    {
      id: 2,
      name: "Client Introductory Letter",
      category: "Client Communication",
      lastModified: "2024-01-12",
      size: "1.8 KB",
      usage: 23,
      status: "active"
    },
    {
      id: 3,
      name: "Form Interrogatories - Personal Injury",
      category: "Discovery",
      lastModified: "2024-01-10",
      size: "5.2 KB",
      usage: 67,
      status: "active"
    },
    {
      id: 4,
      name: "Motion to Dismiss Template",
      category: "Motions",
      lastModified: "2024-01-08",
      size: "3.1 KB",
      usage: 12,
      status: "draft"
    },
    {
      id: 5,
      name: "Settlement Demand Letter",
      category: "Negotiation",
      lastModified: "2024-01-05",
      size: "2.7 KB",
      usage: 34,
      status: "active"
    }
  ];

  const categories = ["All", "Discovery", "Client Communication", "Motions", "Negotiation", "Pleadings"];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUpload = () => {
    toast({
      title: "Template Upload",
      description: "File upload functionality would be implemented here.",
    });
  };

  const handleEdit = (templateId: number) => {
    toast({
      title: "Edit Template",
      description: `Opening editor for template ${templateId}`,
    });
  };

  const handleDelete = (templateId: number) => {
    toast({
      title: "Template Deleted",
      description: "Template has been removed from your library.",
      variant: "destructive",
    });
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
            <Button onClick={handleUpload} className="bg-primary hover:bg-primary/90">
              <Upload className="mr-2 h-4 w-4" />
              Upload Template
            </Button>
          </CardTitle>
          <CardDescription className="text-steel-blue-600">
            Manage your firm's document templates for AI generation
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
                  <FileText className="h-8 w-8 text-steel-blue-500" />
                  <div>
                    <h3 className="font-medium text-steel-blue-800">{template.name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="secondary" className="bg-steel-blue-100 text-steel-blue-700">
                        {template.category}
                      </Badge>
                      <Badge 
                        variant={template.status === "active" ? "default" : "secondary"}
                        className={template.status === "active" ? "bg-green-100 text-green-800" : ""}
                      >
                        {template.status}
                      </Badge>
                      <span className="text-xs text-steel-blue-600">
                        Used {template.usage} times
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right text-sm text-steel-blue-600">
                    <div>{template.size}</div>
                    <div>Modified {template.lastModified}</div>
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
              <Button variant="outline" className="mt-4 border-steel-blue-300">
                <Plus className="mr-2 h-4 w-4" />
                Create New Template
              </Button>
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
                <span className="text-steel-blue-600">Active</span>
                <span className="font-medium text-green-600">
                  {templates.filter(t => t.status === "active").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-steel-blue-600">Draft</span>
                <span className="font-medium text-yellow-600">
                  {templates.filter(t => t.status === "draft").length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 border-steel-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-steel-blue-800">Most Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {templates
                .sort((a, b) => b.usage - a.usage)
                .slice(0, 3)
                .map((template, index) => (
                  <div key={template.id} className="flex justify-between">
                    <span className="text-steel-blue-600 truncate">
                      {index + 1}. {template.name.slice(0, 20)}...
                    </span>
                    <span className="font-medium text-steel-blue-800">{template.usage}</span>
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
              <Button variant="outline" className="w-full justify-start border-steel-blue-300">
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
              <Button variant="outline" className="w-full justify-start border-steel-blue-300">
                <Upload className="mr-2 h-4 w-4" />
                Import Templates
              </Button>
              <Button variant="outline" className="w-full justify-start border-steel-blue-300">
                <Filter className="mr-2 h-4 w-4" />
                Bulk Edit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TemplateManager;
