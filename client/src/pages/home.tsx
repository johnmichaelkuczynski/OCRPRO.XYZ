import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { queryClient } from "@/lib/queryClient";
import { 
  Upload, 
  FileText, 
  Copy, 
  Download, 
  X, 
  CheckCircle2,
  Loader2,
  FileImage,
  ScanText,
  RotateCcw,
  LogIn,
  LogOut,
  CreditCard,
  Clock,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2
} from "lucide-react";

const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB in bytes
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain"
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  // Access status query
  const { data: accessStatus, isLoading: accessLoading } = useQuery<{
    hasAccess: boolean;
    expiresAt: string | null;
  }>({
    queryKey: ["/api/access-status"],
    enabled: isAuthenticated,
  });

  // Check for payment success/cancelled in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      toast({
        title: "Payment successful!",
        description: "You now have 1-day access to the OCR feature.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/access-status"] });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("payment") === "cancelled") {
      toast({
        title: "Payment cancelled",
        description: "Your payment was cancelled.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create checkout session");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Payment error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const hasAccess = accessStatus?.hasAccess || false;

  // Calculate remaining hours
  const getRemainingTime = () => {
    if (!accessStatus?.expiresAt) return null;
    const expiresAt = new Date(accessStatus.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };
  
  const remainingTime = hasAccess ? getRemainingTime() : null;

  // TXT Combiner state
  const [txtFiles, setTxtFiles] = useState<File[]>([]);
  const [combinedText, setCombinedText] = useState<string>("");
  const [isCombining, setIsCombining] = useState(false);
  const [txtCopied, setTxtCopied] = useState(false);
  const [isTxtDragging, setIsTxtDragging] = useState(false);

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
      return "Please upload a PDF, PNG, JPG, or TXT file";
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

  // TXT Combiner functions
  const handleTxtFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const txtFilesOnly = files.filter(f => f.name.endsWith('.txt'));
    if (txtFilesOnly.length !== files.length) {
      toast({
        title: "Some files skipped",
        description: "Only .txt files are accepted",
        variant: "destructive",
      });
    }
    setTxtFiles(prev => [...prev, ...txtFilesOnly]);
    setCombinedText("");
  }, [toast]);

  const handleTxtDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsTxtDragging(true);
  }, []);

  const handleTxtDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsTxtDragging(false);
  }, []);

  const handleTxtDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsTxtDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const txtFilesOnly = droppedFiles.filter(f => f.name.endsWith('.txt'));
    if (txtFilesOnly.length !== droppedFiles.length) {
      toast({
        title: "Some files skipped",
        description: "Only .txt files are accepted",
        variant: "destructive",
      });
    }
    if (txtFilesOnly.length > 0) {
      setTxtFiles(prev => [...prev, ...txtFilesOnly]);
      setCombinedText("");
    }
  }, [toast]);

  const handleCombineFiles = useCallback(async () => {
    if (txtFiles.length === 0) return;
    setIsCombining(true);
    try {
      // Read files sequentially to preserve exact order
      const contents: string[] = [];
      for (const file of txtFiles) {
        const text = await file.text();
        contents.push(text);
      }
      const combined = contents.join("\n\n--- Next File ---\n\n");
      setCombinedText(combined);
      toast({
        title: "Files combined",
        description: `Combined ${txtFiles.length} files in order`,
      });
    } catch {
      toast({
        title: "Error combining files",
        description: "Failed to read one or more files",
        variant: "destructive",
      });
    } finally {
      setIsCombining(false);
    }
  }, [txtFiles, toast]);

  const handleCopyTxt = useCallback(async () => {
    await navigator.clipboard.writeText(combinedText);
    setTxtCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "Combined text has been copied",
    });
    setTimeout(() => setTxtCopied(false), 2000);
  }, [combinedText, toast]);

  const handleDownloadTxt = useCallback(() => {
    const blob = new Blob([combinedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "combined-text.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded",
      description: "Combined file has been downloaded",
    });
  }, [combinedText, toast]);

  const handleClearTxt = useCallback(() => {
    setTxtFiles([]);
    setCombinedText("");
  }, []);

  // Reordering functions
  const moveFileUp = useCallback((index: number) => {
    if (index <= 0) return;
    setTxtFiles(prev => {
      const newFiles = [...prev];
      [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
      return newFiles;
    });
    setCombinedText("");
  }, []);

  const moveFileDown = useCallback((index: number) => {
    setTxtFiles(prev => {
      if (index >= prev.length - 1) return prev;
      const newFiles = [...prev];
      [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
      return newFiles;
    });
    setCombinedText("");
  }, []);

  const removeFile = useCallback((index: number) => {
    setTxtFiles(prev => prev.filter((_, i) => i !== index));
    setCombinedText("");
  }, []);

  // Drag and drop reordering state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFileDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleFileDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    setTxtFiles(prev => {
      const newFiles = [...prev];
      const draggedFile = newFiles[draggedIndex];
      newFiles.splice(draggedIndex, 1);
      newFiles.splice(index, 0, draggedFile);
      return newFiles;
    });
    setDraggedIndex(index);
  }, [draggedIndex]);

  const handleFileDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setCombinedText("");
  }, []);

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
          <div className="flex items-center gap-3">
            {authLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                {/* Access Status Badge */}
                {accessLoading ? (
                  <Badge variant="secondary">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Checking...
                  </Badge>
                ) : hasAccess ? (
                  <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" data-testid="badge-access-active">
                    <Clock className="h-3 w-3 mr-1" />
                    {remainingTime || "Access Active"}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => paymentMutation.mutate()}
                    disabled={paymentMutation.isPending}
                    data-testid="button-buy-access"
                  >
                    {paymentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Buy Access ($1)
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                    <AvatarFallback>
                      {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:inline">
                    {user.firstName || user.email?.split("@")[0] || "User"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  data-testid="button-logout"
                >
                  <a href="/api/logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </a>
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                asChild
                data-testid="button-login"
              >
                <a href="/api/login">
                  <LogIn className="h-4 w-4 mr-2" />
                  Login with Google
                </a>
              </Button>
            )}
            <ThemeToggle />
          </div>
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
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
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
                    <Badge variant="secondary">TXT</Badge>
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleClear}
                      className="gap-2"
                      data-testid="button-reset"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset
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
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <span>Upload</span>
              </div>
              <div className="flex items-center gap-2">
                <ScanText className="h-4 w-4 text-primary" />
                <span>Extract</span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <span>Export</span>
              </div>
            </div>
          )}

          {/* TXT Combiner Section */}
          <div className="border-t pt-8 mt-8">
            <div className="text-center space-y-3 mb-6">
              <h2 className="text-2xl font-bold tracking-tight">
                Combine TXT Files
              </h2>
              <p className="text-muted-foreground">
                Select multiple .txt files to combine them into one
              </p>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-4">
                  <label
                    htmlFor="txt-upload"
                    className={`flex flex-col items-center justify-center w-full p-8 rounded-md transition-all duration-200 cursor-pointer ${
                      isTxtDragging
                        ? "bg-primary/5 border-2 border-dashed border-primary"
                        : "bg-muted/30 border-2 border-dashed border-muted-foreground/20 hover-elevate"
                    }`}
                    data-testid="dropzone-txt-upload"
                    onDragOver={handleTxtDragOver}
                    onDragLeave={handleTxtDragLeave}
                    onDrop={handleTxtDrop}
                  >
                    <FileText className={`h-10 w-10 mb-3 ${isTxtDragging ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-lg font-medium">
                      {isTxtDragging ? "Drop TXT files here" : "Drag & drop TXT files here"}
                    </p>
                    <p className="text-sm text-muted-foreground">or click to choose multiple .txt files</p>
                    <input
                      id="txt-upload"
                      type="file"
                      multiple
                      accept=".txt"
                      className="sr-only"
                      onChange={handleTxtFilesChange}
                      data-testid="input-txt-upload"
                    />
                  </label>

                  {txtFiles.length > 0 && (
                    <div className="w-full space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {txtFiles.length} file(s) selected - Drag to reorder
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearTxt}
                          data-testid="button-clear-txt"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Clear All
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {txtFiles.map((f, i) => (
                          <div
                            key={`${f.name}-${i}`}
                            draggable
                            onDragStart={() => handleFileDragStart(i)}
                            onDragOver={(e) => handleFileDragOver(e, i)}
                            onDragEnd={handleFileDragEnd}
                            className={`flex items-center gap-2 p-2 rounded-md border transition-all ${
                              draggedIndex === i
                                ? "bg-primary/10 border-primary"
                                : "bg-muted/30 border-muted-foreground/20 hover-elevate"
                            }`}
                            data-testid={`file-item-${i}`}
                          >
                            <div className="cursor-grab text-muted-foreground hover:text-foreground">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {i + 1}
                            </Badge>
                            <span className="flex-1 text-sm truncate" title={f.name}>
                              {f.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => moveFileUp(i)}
                                disabled={i === 0}
                                data-testid={`button-move-up-${i}`}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => moveFileDown(i)}
                                disabled={i === txtFiles.length - 1}
                                data-testid={`button-move-down-${i}`}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removeFile(i)}
                                data-testid={`button-remove-file-${i}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        onClick={handleCombineFiles}
                        disabled={isCombining}
                        className="w-full"
                        data-testid="button-combine-files"
                      >
                        {isCombining ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Combining...
                          </>
                        ) : (
                          "Combine Files"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {combinedText && (
              <Card className="mt-4">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Combined Text</span>
                      <Badge variant="secondary" className="text-xs">
                        {combinedText.length.toLocaleString()} characters
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyTxt}
                        className="gap-2"
                        data-testid="button-copy-combined"
                      >
                        {txtCopied ? (
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
                        onClick={handleDownloadTxt}
                        className="gap-2"
                        data-testid="button-download-combined"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleClearTxt}
                        className="gap-2"
                        data-testid="button-reset-combined"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div 
                      className="min-h-[200px] max-h-[500px] overflow-auto rounded-md bg-muted/50 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap"
                      data-testid="text-combined-content"
                    >
                      {combinedText}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
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
