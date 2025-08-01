-- Create storage bucket for templates
INSERT INTO storage.buckets (id, name, public) VALUES ('templates', 'templates', false);

-- Create storage policies for templates
CREATE POLICY "Users can view templates in their firm" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload templates to their firm" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own templates" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own templates" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'templates' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Update templates table to support file-based templates
ALTER TABLE public.templates 
ADD COLUMN file_path TEXT,
ADD COLUMN file_type TEXT DEFAULT 'text',
ADD COLUMN template_variables JSONB DEFAULT '[]'::jsonb;

-- Make content nullable since we'll use file_path for .docx files
ALTER TABLE public.templates ALTER COLUMN content DROP NOT NULL;