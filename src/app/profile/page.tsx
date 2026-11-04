"use client";

import { useEffect, useState } from "react";
import { Upload, Save, CheckCircle2, Plus, X, Sparkles, RefreshCw, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
          setFullName(p.fullName || "");
          setEmail(p.email || "");
          setPhone(p.phone || "");
          setLocation(p.location || "");
          setGithubUrl(p.githubUrl || "");
          setLinkedinUrl(p.linkedinUrl || "");
          setPortfolioUrl(p.portfolioUrl || "");
          setSummary(p.summary || "");
          setSkills(p.skills || []);
          setExperience(p.experience || []);
          setEducation(p.education || []);
        }
        alert("Resume parsed and profile fields populated successfully.");
      }
    } catch {
      alert("Error uploading resume.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
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

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl animate-enter">
        <div className="space-y-2">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-7 w-64 rounded" />
          <div className="skeleton h-4 w-80 rounded" />
        </div>
        <div className="skeleton h-32 w-full rounded-md" />
        <div className="skeleton h-48 w-full rounded-md" />
        <div className="skeleton h-32 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl animate-enter">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Candidate context</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Master profile
          </h1>
          <p className="text-sm text-muted-foreground">
            Parameters and skills matrix for cover letter tailoring.
          </p>
        </div>

        <Button
          onClick={() => handleSave()}
          disabled={saving}
          size="sm"
          className="text-xs h-8 px-3.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all duration-150 shrink-0"
        >
          {savedSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save profile
            </>
          )}
        </Button>
      </div>

      {/* PDF Upload */}
      <div className="border border-dashed border-border bg-card/40 rounded-md p-6 text-center space-y-3 hover:border-primary/30 transition-colors duration-200">
        <div className="w-10 h-10 rounded-md bg-secondary border border-border flex items-center justify-center mx-auto text-primary">
          {uploading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
        </div>
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-foreground">
            Upload resume PDF
          </h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Extracts contact info, skills, and experience into your local store.
          </p>
        </div>

        <label className="cursor-pointer inline-block">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <span className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-border bg-card hover:bg-secondary px-3.5 py-1.5 cursor-pointer transition-colors duration-150">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
            {uploading ? "Extracting…" : "Select resume PDF"}
          </span>
        </label>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="space-y-5">
        {/* Contact Info */}
        <section className="border border-border bg-card rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Contact information</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Used for Easy Apply form fields.</p>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-xs text-muted-foreground">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Alex Morgan" className="h-8 text-[13px] rounded-md border-border bg-background" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@example.com" className="h-8 text-[13px] rounded-md border-border bg-background" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs text-muted-foreground">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" className="h-8 text-[13px] rounded-md border-border bg-background font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-xs text-muted-foreground">Location</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="San Francisco, CA" className="h-8 text-[13px] rounded-md border-border bg-background" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="linkedinUrl" className="text-xs text-muted-foreground">LinkedIn URL</Label>
              <Input id="linkedinUrl" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/in/username" className="h-8 text-[13px] rounded-md border-border bg-background font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="githubUrl" className="text-xs text-muted-foreground">GitHub / Portfolio</Label>
              <Input id="githubUrl" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="github.com/username" className="h-8 text-[13px] rounded-md border-border bg-background font-mono" />
            </div>
          </div>
        </section>

        {/* Target Roles */}
        <section className="border border-border bg-card rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Target Titles &amp; Focus Roles</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Keywords searched during automated sweeps (e.g. Software Engineer Intern, Web Developer Intern, Python Developer).
            </p>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Add target title (e.g. Software Engineer Intern, Full Stack Developer)…"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTargetRole(); } }}
                className="h-8 text-[13px] rounded-md border-border bg-background flex-1"
              />
              <Button type="button" size="sm" onClick={addTargetRole} variant="outline" className="text-xs h-8 px-3 rounded-md border-border bg-card hover:bg-secondary transition-colors duration-150">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {targetRoles.map((role) => (
                <span key={role} className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-secondary/60 text-xs text-foreground hover:border-border/80 transition-colors duration-150">
                  {role}
                  <button type="button" onClick={() => removeTargetRole(role)} className="opacity-50 hover:opacity-100 hover:text-destructive transition-opacity duration-150 p-0.5" aria-label={`Remove ${role}`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {targetRoles.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No target roles added yet</span>
              )}
            </div>
          </div>
        </section>

        {/* Skills Matrix */}
        <section className="border border-border bg-card rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Skills matrix</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Referenced by LLM for cover letters and screening answers.</p>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Add skill (e.g. TypeScript, React)…"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                className="h-8 text-[13px] rounded-md border-border bg-background flex-1"
              />
              <Button type="button" size="sm" onClick={addSkill} variant="outline" className="text-xs h-8 px-3 rounded-md border-border bg-card hover:bg-secondary transition-colors duration-150">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <span key={skill} className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-primary/15 bg-primary/5 text-xs text-foreground hover:border-primary/25 transition-colors duration-150">
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)} className="opacity-40 hover:opacity-100 hover:text-destructive transition-opacity duration-150 p-0.5" aria-label={`Remove ${skill}`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {skills.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No skills added yet</span>
              )}
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className="border border-border bg-card rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Background summary</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Grounding narrative for LLM prompts.</p>
          </div>

          <div className="p-4">
            <Textarea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Concise overview of your expertise, achievements, and strengths…"
              className="text-[13px] leading-relaxed rounded-md border-border bg-background resize-y"
            />
          </div>
        </section>
      </form>
    </div>
  );
}
