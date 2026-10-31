"use client";

import { useEffect, useState } from "react";
import { Upload, Save, CheckCircle2, FileText, Plus, X, Sparkles, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState("");
  const [experience, setExperience] = useState<any[]>([]);
  const [education, setEducation] = useState<any[]>([]);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          const p = data.profile;
          if (p) {
            setFullName(p.full_name || "");
            setEmail(p.email || "");
            setPhone(p.phone || "");
            setLocation(p.location || "");
            setGithubUrl(p.github_url || "");
            setLinkedinUrl(p.linkedin_url || "");
            setPortfolioUrl(p.portfolio_url || "");
            setSummary(p.summary || "");
            setSkills(p.skills || []);
            setTargetRoles(p.targetRoles || ["Full Stack Developer", "Software Engineer"]);
            setExperience(p.experience || []);
            setEducation(p.education || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a valid PDF file.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("resume", file);

    try {
      const res = await fetch("/api/profile/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to parse PDF resume.");
      } else {
        const p = data.profile;
        if (p) {
          if (p.fullName) setFullName(p.fullName);
          if (p.email) setEmail(p.email);
          if (p.phone) setPhone(p.phone);
          if (p.location) setLocation(p.location);
          if (p.githubUrl) setGithubUrl(p.githubUrl);
          if (p.linkedinUrl) setLinkedinUrl(p.linkedinUrl);
          if (p.portfolioUrl) setPortfolioUrl(p.portfolioUrl);
          if (p.summary) setSummary(p.summary);
          if (p.skills?.length) setSkills(p.skills);
          if (p.experience?.length) setExperience(p.experience);
          if (p.education?.length) setEducation(p.education);
        }
        alert("Resume parsed successfully! Structured fields have been populated.");
      }
    } catch (err) {
      alert("Error uploading resume.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          location,
          githubUrl,
          linkedinUrl,
          portfolioUrl,
          summary,
          skills,
          experience,
          education,
          targetRoles,
        }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        alert("Failed to save profile.");
      }
    } catch {
      alert("Network error saving profile.");
    } finally {
      setSaving(false);
    }
  }

  function addSkill() {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  }

  function removeSkill(item: string) {
    setSkills(skills.filter((s) => s !== item));
  }

  function addTargetRole() {
    if (newRole.trim() && !targetRoles.includes(newRole.trim())) {
      setTargetRoles([...targetRoles, newRole.trim()]);
      setNewRole("");
    }
  }

  function removeTargetRole(role: string) {
    setTargetRoles(targetRoles.filter((r) => r !== role));
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Master Profile & Resume Engine</h1>
          <p className="text-sm text-muted-foreground">
            Phase 1 onboarding: Ingest Master Resume PDF, extract skills matrix with LLM, and calibrate target roles.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          {savedSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Profile
            </>
          )}
        </Button>
      </div>

      {/* PDF Upload Card */}
      <Card className="border-dashed border-2 bg-muted/10">
        <CardContent className="p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            {uploading ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm">Upload Master Resume (PDF)</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              Upload your PDF resume. Our zero-shot LLM parser will extract contact details, skills, experience, and education matrix into SQLite.
            </p>
          </div>

          <div className="pt-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <span className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-input bg-background shadow-xs hover:bg-accent px-4 py-2 cursor-pointer transition-colors">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
                {uploading ? "Parsing with LLM..." : "Select Resume PDF"}
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Contact and Identity Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal & Contact Coordinates</CardTitle>
            <CardDescription>
              Populated automatically during submission forms and Easy Apply dialogs.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alex Morgan"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. alex@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1 555 123 4567"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Location / City</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA / Remote"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
              <Input
                id="linkedinUrl"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="githubUrl">GitHub / Portfolio URL</Label>
              <Input
                id="githubUrl"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username"
              />
            </div>
          </CardContent>
        </Card>

        {/* Target Job Roles (Search Keywords for Crawlers) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Target Job Keywords & Roles</CardTitle>
            <CardDescription>
              Keywords actively monitored and searched across LinkedIn & Internshala crawlers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Add role keyword (e.g. Frontend Engineer, Full Stack Developer)..."
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTargetRole();
                  }
                }}
                className="text-xs"
              />
              <Button type="button" size="sm" onClick={addTargetRole} variant="outline" className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {targetRoles.map((role) => (
                <Badge key={role} variant="secondary" className="pl-2.5 pr-1 py-1 text-xs flex items-center gap-1.5">
                  <span>{role}</span>
                  <button
                    type="button"
                    onClick={() => removeTargetRole(role)}
                    className="hover:text-destructive p-0.5 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Skills Matrix */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skills Matrix</CardTitle>
            <CardDescription>
              Synthesized by LLM to match keywords and auto-complete screening assessments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Add skill (e.g. Next.js, TypeScript, PostgreSQL)..."
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                className="text-xs"
              />
              <Button type="button" size="sm" onClick={addSkill} variant="outline" className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {skills.map((skill) => (
                <Badge key={skill} variant="outline" className="pl-2.5 pr-1 py-1 text-xs flex items-center gap-1.5 bg-background">
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="hover:text-destructive p-0.5 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Executive Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Professional Summary & Base Context</CardTitle>
            <CardDescription>
              Supplied as foundational grounding to Gemini/Groq when tailoring the 150-word cover letters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Provide a concise 2-3 sentence overview of your domain expertise, key accomplishments, and engineering background..."
              className="text-xs leading-relaxed"
            />
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
