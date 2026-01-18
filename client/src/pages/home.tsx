import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  Upload, 
  FileText, 
  Copy, 
  Download, 
  X, 
  CheckCircle2,
  Loader2,
  FileImage,
  ScanText
} from "lucide-react";

const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB in bytes
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg"
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const ocrMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to process file");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setExtractedText(data.text);
      toast({
        title: "Text extracted successfully",
        description: `Processed ${data.pages || 1} page(s)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error processing file",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Please upload a PDF, PNG, or JPG file";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size must be less than 300MB";
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      toast({
        title: "Invalid file",
        description: error,
        variant: "destructive",
      });
      return;
    }
    setFile(file);
    setExtractedText("");
    ocrMutation.mutate(file);
  }, [toast, ocrMutation]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  }, [handleFile]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(extractedText);
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "Text has been copied to your clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  }, [extractedText, toast]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([extractedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file ? `${file.name.replace(/\.[^/.]+$/, "")}.txt` : "extracted-text.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded",
      description: "Text file has been downloaded",
    });
  }, [extractedText, file, toast]);

  const handleClear = useCallback(() => {
    setFile(null);
    setExtractedText("");
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (type: string) => {
    if (type === "application/pdf") return <FileText className="h-5 w-5" />;
    return <FileImage className="h-5 w-5" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <ScanText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Document Scanner</h1>
              <p className="text-xs text-muted-foreground">OCR Text Extraction</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-bold tracking-tight">
              Extract Text from Documents
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Upload scanned PDFs or images (PNG, JPG) up to 300MB. Our OCR technology will extract all text content for you to copy or download.
            </p>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <label
                htmlFor="file-upload"
                className={`relative flex flex-col items-center justify-center transition-all duration-200 p-12 rounded-md ${
                  ocrMutation.isPending 
                    ? "cursor-not-allowed opacity-60 bg-muted/30 border-2 border-dashed border-muted-foreground/20"
                    : isDragging 
                      ? "cursor-pointer bg-primary/5 border-2 border-dashed border-primary" 
                      : "cursor-pointer bg-muted/30 border-2 border-dashed border-muted-foreground/20 hover-elevate"
                }`}
                onDragOver={ocrMutation.isPending ? undefined : handleDragOver}
                onDragLeave={ocrMutation.isPending ? undefined : handleDragLeave}
                onDrop={ocrMutation.isPending ? undefined : handleDrop}
                data-testid="dropzone-file-upload"
              >
                <input
                  id="file-upload"
                  type="file"
                  className="sr-only"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleInputChange}
                  disabled={ocrMutation.isPending}
                  data-testid="input-file-upload"
                />
                
                <div className={`flex flex-col items-center gap-4 transition-transform ${isDragging ? "scale-105" : ""}`}>
                  <div className={`rounded-full p-4 ${isDragging ? "bg-primary/10" : "bg-muted"}`}>
                    <Upload className={`h-10 w-10 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium">
                      {isDragging ? "Drop your file here" : "Drag & drop your file here"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="secondary">PDF</Badge>
                    <Badge variant="secondary">PNG</Badge>
                    <Badge variant="secondary">JPG</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum file size: 300MB
                  </p>
                </div>
              </label>
            </CardContent>
          </Card>

          {file && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      {getFileIcon(file.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate" data-testid="text-filename">{file.name}</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-filesize">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ocrMutation.isPending && (
                      <Badge variant="secondary" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing
                      </Badge>
                    )}
                    {ocrMutation.isSuccess && (
                      <Badge className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Complete
                      </Badge>
                    )}
                    {ocrMutation.isError && (
                      <Badge variant="destructive" className="gap-1">
                        <X className="h-3 w-3" />
                        Failed
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleClear}
                      disabled={ocrMutation.isPending}
                      data-testid="button-clear-file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {ocrMutation.isPending && (
                  <div className="mt-4 space-y-2">
                    <Progress value={undefined} className="h-1" />
                    <p className="text-xs text-muted-foreground text-center">
                      Extracting text... This may take a moment for larger files.
                    </p>
                  </div>
                )}
                {ocrMutation.isError && (
                  <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive" data-testid="text-error-message">
                      {(ocrMutation.error as Error)?.message || "Failed to process file. Please try again."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {extractedText && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Extracted Text</span>
                    <Badge variant="secondary" className="text-xs">
                      {extractedText.length.toLocaleString()} characters
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="gap-2"
                      data-testid="button-copy-text"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      className="gap-2"
                      data-testid="button-download-text"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <div 
                    className="min-h-[200px] max-h-[500px] overflow-auto rounded-md bg-muted/50 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap"
                    data-testid="text-extracted-content"
                  >
                    {extractedText}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!file && !extractedText && (
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="p-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Upload</h3>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop or click to upload your scanned documents
                  </p>
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="rounded-full bg-primary/10 p-3">
                    <ScanText className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Extract</h3>
                  <p className="text-sm text-muted-foreground">
                    AI-powered OCR extracts text from your images and PDFs
                  </p>
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Download className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">Export</h3>
                  <p className="text-sm text-muted-foreground">
                    Copy to clipboard or download as a text file
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by Azure Cognitive Services</p>
        </div>
      </footer>
    </div>
  );
}
