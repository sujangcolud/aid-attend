import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileText, Eye, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface QuestionPaperViewerProps {
  testId: string;
  testName: string;
  fileName?: string;
  onClose?: () => void;
}

export default function QuestionPaperViewer({
  testId,
  testName,
  fileName,
  onClose,
}: QuestionPaperViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | 'unknown'>('unknown');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && fileName) {
      loadFile();
    }
  }, [isOpen, fileName]);

  const loadFile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get the signed URL for the file
      const { data, error: urlError } = await supabase.storage
        .from('test-files')
        .createSignedUrl(fileName!, 3600); // 1 hour expiry

      if (urlError) throw urlError;

      setFileUrl(data.signedUrl);

      // Determine file type
      const ext = fileName?.toLowerCase().split('.').pop();
      if (ext === 'pdf') {
        setFileType('pdf');
      } else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) {
        setFileType('image');
      } else {
        setFileType('unknown');
      }
    } catch (err) {
      setError('Failed to load file. Please try again.');
      console.error('Error loading file:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadFile = async () => {
    try {
      if (!fileUrl) return;
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'question-paper';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download file');
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        title="View question paper"
      >
        <Eye className="h-4 w-4 mr-1" />
        View
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {testName}
            </DialogTitle>
          </DialogHeader>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {!isLoading && fileUrl && !error && (
            <div className="flex-1 overflow-auto bg-gray-50 rounded-lg border">
              {fileType === 'pdf' && (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <iframe
                    src={`${fileUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                    className="w-full h-full rounded-lg border"
                    title={testName}
                  />
                </div>
              )}

              {fileType === 'image' && (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img
                    src={fileUrl}
                    alt={testName}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                </div>
              )}

              {fileType === 'unknown' && (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-center text-muted-foreground mb-4">
                    This file type cannot be previewed in the browser.
                  </p>
                  <Button onClick={downloadFile} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download File
                  </Button>
                </div>
              )}
            </div>
          )}

          {!isLoading && fileUrl && !error && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {fileName}
              </p>
              <Button onClick={downloadFile} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
