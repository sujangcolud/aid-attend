import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Papa from "papaparse";

interface StudentRow {
  name: string;
  grade: string;
  contact_number: string;
  school_name: string;
  parent_name: string;
}

interface ValidationResult {
  valid: StudentRow[];
  invalid: Array<{ row: number; data: any; error: string }>;
  duplicates: Array<{ name: string; count: number }>;
}

export default function BulkStudentRegistration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fileData, setFileData] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Validate CSV data
  const validateCSVData = (data: any[]): ValidationResult => {
    const valid: StudentRow[] = [];
    const invalid: Array<{ row: number; data: any; error: string }> = [];
    const nameCount: Record<string, number> = {};

    data.forEach((row, index) => {
      const studentRow: StudentRow = {
        name: row.name?.trim() || "",
        grade: row.grade?.trim() || "",
        contact_number: row.contact_number?.trim() || "",
        school_name: row.school_name?.trim() || "",
        parent_name: row.parent_name?.trim() || "",
      };

      const errors: string[] = [];

      // Validate fields
      if (!studentRow.name) errors.push("Name is required");
      if (!studentRow.grade) errors.push("Grade is required");
      if (!studentRow.contact_number) errors.push("Contact number is required");
      if (!studentRow.school_name) errors.push("School name is required");
      if (!studentRow.parent_name) errors.push("Parent name is required");

      // Validate contact number format (basic)
      if (studentRow.contact_number && !/^\d{10}$/.test(studentRow.contact_number)) {
        errors.push("Contact number must be 10 digits");
      }

      if (errors.length > 0) {
        invalid.push({
          row: index + 2, // +2 because 1 is header, +1 for display
          data: studentRow,
          error: errors.join(", "),
        });
      } else {
        valid.push(studentRow);
        nameCount[studentRow.name] = (nameCount[studentRow.name] || 0) + 1;
      }
    });

    // Find duplicates
    const duplicates = Object.entries(nameCount)
      .filter(([, count]) => count > 1)
      .map(([name, count]) => ({ name, count }));

    return { valid, invalid, duplicates };
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validation = validateCSVData(results.data);
        setFileData(validation);
        setIsProcessing(false);

        if (validation.valid.length > 0) {
          toast.success(`${validation.valid.length} valid records found`);
        }
        if (validation.invalid.length > 0) {
          toast.warning(`${validation.invalid.length} invalid records found`);
        }
        if (validation.duplicates.length > 0) {
          toast.warning(`${validation.duplicates.length} duplicate names found`);
        }
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
        setIsProcessing(false);
      },
    });
  };

  // Upload students mutation
  const uploadStudentsMutation = useMutation({
    mutationFn: async () => {
      if (!fileData || fileData.valid.length === 0) {
        throw new Error("No valid records to upload");
      }

      const studentsToInsert = fileData.valid.map((student) => ({
        ...student,
        center_id: user?.center_id || null,
      }));

      const { data, error } = await supabase.from("students").insert(studentsToInsert).select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully registered ${data.length} students!`);
      setFileData(null);
      queryClient.invalidateQueries({ queryKey: ["students", user?.center_id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to register students");
    },
  });

  const handleUpload = () => {
    if (!fileData || fileData.valid.length === 0) {
      toast.error("Please select a valid CSV file with at least one valid record");
      return;
    }

    if (fileData.duplicates.length > 0) {
      const confirmed = window.confirm(
        `There are ${fileData.duplicates.length} duplicate names. Do you want to continue?`
      );
      if (!confirmed) return;
    }

    uploadStudentsMutation.mutate();
  };

  const downloadTemplate = () => {
    const template = "name,grade,contact_number,school_name,parent_name\nJohn Doe,10,9841234567,ABC School,Jane Doe\n";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_template.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Student Registration</h1>
        <p className="text-muted-foreground">
          Upload a CSV file to register multiple students at once
        </p>
      </div>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">CSV Format Required:</p>
            <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
              name, grade, contact_number, school_name, parent_name
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Requirements:</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>All fields are required</li>
              <li>Contact number must be exactly 10 digits</li>
              <li>Duplicate names will be flagged for review</li>
              <li>Students will be automatically linked to your center</li>
            </ul>
          </div>
          <Button onClick={downloadTemplate} variant="outline" className="w-full md:w-auto">
            Download CSV Template
          </Button>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Select CSV File</CardTitle>
          <CardDescription>Choose a CSV file to upload</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isProcessing || uploadStudentsMutation.isPending}
              className="cursor-pointer"
            />
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {fileData && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Valid Records</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="text-2xl font-bold text-green-600">{fileData.valid.length}</p>
                  </div>
                </div>
                {fileData.invalid.length > 0 && (
                  <div className="space-y-1 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Invalid Records</p>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <p className="text-2xl font-bold text-red-600">{fileData.invalid.length}</p>
                    </div>
                  </div>
                )}
                {fileData.duplicates.length > 0 && (
                  <div className="space-y-1 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Duplicate Names</p>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <p className="text-2xl font-bold text-yellow-600">{fileData.duplicates.length}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Invalid Records */}
          {fileData.invalid.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Invalid Records</CardTitle>
                <CardDescription>Fix these records and re-upload</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fileData.invalid.map((record) => (
                        <TableRow key={`${record.row}`}>
                          <TableCell>{record.row}</TableCell>
                          <TableCell className="text-sm">{record.data.name || "N/A"}</TableCell>
                          <TableCell className="text-red-600 text-sm">{record.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Duplicate Names */}
          {fileData.duplicates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Duplicate Names</CardTitle>
                <CardDescription>These names appear multiple times in your CSV</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {fileData.duplicates.map((dup) => (
                    <div key={dup.name} className="flex items-center justify-between p-2 border rounded">
                      <span className="font-medium">{dup.name}</span>
                      <span className="text-sm text-muted-foreground">{dup.count} occurrences</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Valid Records Preview */}
          {fileData.valid.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Preview - Valid Records</CardTitle>
                <CardDescription>These students will be registered</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>Parent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fileData.valid.slice(0, 10).map((student, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{student.grade}</TableCell>
                          <TableCell>{student.contact_number}</TableCell>
                          <TableCell>{student.school_name}</TableCell>
                          <TableCell>{student.parent_name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {fileData.valid.length > 10 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Showing 10 of {fileData.valid.length} records...
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upload Button */}
          <div className="flex gap-4">
            <Button
              onClick={handleUpload}
              disabled={
                uploadStudentsMutation.isPending ||
                fileData.valid.length === 0
              }
              className="flex-1"
              size="lg"
            >
              {uploadStudentsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Register {fileData.valid.length} Students
                </>
              )}
            </Button>
            <Button
              onClick={() => setFileData(null)}
              variant="outline"
              size="lg"
              disabled={uploadStudentsMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
