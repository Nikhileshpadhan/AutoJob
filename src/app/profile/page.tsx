"use client";

import React, { useEffect, useState } from "react";
import {
  Upload,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Briefcase,
  GraduationCap,
  HelpCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useTelemetry } from "@/components/telemetry-provider";

interface ExperienceItem {
  role: string;
  company: string;
  duration: string;
  description: string;
}

interface EducationItem {
  degree: string;
  institution: string;
  year: string;
}

interface ProjectItem {
  title: string;
  tech: string;
  description: string;
  link?: string;
}

interface ScreeningDefaults {
  graduationYear?: string;
  gpa?: string;
  noticePeriodDays?: string;
  expectedStipend?: string;
  workAuthorization?: string;
  relocationWillingness?: string;
  phone?: string;
}

export default function ProfilePage() {
  const toast = useToast();
  const { refreshStats } = useTelemetry();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tabs: "profile" | "experience" | "screening"
  const [activeTab, setActiveTab] = useState<"profile" | "experience" | "screening">("profile");

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [resumeFilePath, setResumeFilePath] = useState("");

  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");

  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [newRole, setNewRole] = useState("");

  const [experience, setExperience] = useState<ExperienceItem[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [screeningDefaults, setScreeningDefaults] = useState<ScreeningDefaults>({});

  async function fetchProfile() {
    try {
      setLoading(true);
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
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
          setResumeFilePath(p.resumeFilePath || "");
          setSkills(p.skills || []);
          setTargetRoles(p.targetRoles || ["Full Stack Developer", "Software Engineer"]);
          setExperience(p.experience || []);
          setEducation(p.education || []);
          setProjects(p.projects || []);
          setScreeningDefaults(p.screeningDefaults || {});
        }
      }
    } catch (err) {
      toast.error("Could not load candidate profile.", "Load Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProfile();
  }, []);

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a standard PDF resume file.", "Invalid Format");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Resume file exceeds maximum limit of 5 MB.", "File Too Large");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    setUploading(true);
    try {
      const res = await fetch("/api/profile/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to parse resume.", "Upload Failed");
      } else {
        toast.success("Resume parsed and profile updated with candidate details!", "Success");
        await fetchProfile();
        await refreshStats();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error uploading resume.", "Error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
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
        projects,
        screeningDefaults,
        targetRoles,
      };

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save profile.", "Save Failed");
      } else {
        toast.success("Candidate vault profile saved successfully.", "Saved");
        await refreshStats();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving profile.", "Error");
    } finally {
      setSaving(false);
    }
  }

  // Skills
  function addSkill() {
    const s = newSkill.trim();
    if (s && !skills.includes(s)) {
      setSkills((prev) => [...prev, s]);
      setNewSkill("");
    }
  }

  function removeSkill(toRemove: string) {
    setSkills((prev) => prev.filter((s) => s !== toRemove));
  }

  // Target Roles
  function addRole() {
    const r = newRole.trim();
    if (r && !targetRoles.includes(r)) {
      setTargetRoles((prev) => [...prev, r]);
      setNewRole("");
    }
  }

  function removeRole(toRemove: string) {
    setTargetRoles((prev) => prev.filter((r) => r !== toRemove));
  }

  // Experience
  function addExperience() {
    setExperience((prev) => [
      ...prev,
      { role: "Software Intern", company: "Company Name", duration: "Jun 2024 - Present", description: "" },
    ]);
  }

  function updateExperience(index: number, field: keyof ExperienceItem, value: string) {
    setExperience((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function removeExperience(index: number) {
    setExperience((prev) => prev.filter((_, i) => i !== index));
  }

  // Education
  function addEducation() {
    setEducation((prev) => [
      ...prev,
      { degree: "B.Tech in Computer Science", institution: "University Name", year: "2025" },
    ]);
  }

  function updateEducation(index: number, field: keyof EducationItem, value: string) {
    setEducation((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function removeEducation(index: number) {
    setEducation((prev) => prev.filter((_, i) => i !== index));
  }

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <RefreshCw className="w-6 h-6 animate-spin text-[#CCF2DF] mx-auto" />
        <p className="text-xs font-mono uppercase tracking-wider text-[#B8B9B9]">
          Loading candidate vault profile...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-enter">
      {/* Top Header — Aronya display heading */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-6 border-b border-[#303132]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 border border-[#CCF2DF]/40 bg-[#CCF2DF]/10 text-[#CCF2DF]">
              CANDIDATE REPOSITORY
            </span>
            <span className="text-xs uppercase font-mono tracking-widest text-[#B8B9B9]">
              AUTONOMOUS PROFILE
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-normal tracking-[-0.03em] text-white">
            CANDIDATE <span className="font-serif italic font-normal text-white">VAULT</span>
          </h1>
          <p className="text-sm text-[#CCF2DF] font-light max-w-2xl leading-relaxed">
            Master profile schema, resume artifact storage, verified skills hierarchy, and screening response database.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Resume Upload Trigger */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleResumeUpload}
              disabled={uploading}
            />
            <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-xs font-mono uppercase tracking-wider transition-all border-2 border-[#303132] bg-transparent text-white hover:border-white h-12 px-5">
              <Upload className={`w-3.5 h-3.5 mr-1 ${uploading ? "animate-spin text-[#CCF2DF]" : ""}`} />
              {uploading ? "Extracting..." : "Upload Resume (PDF)"}
            </span>
          </label>

          <Button
            size="lg"
            onClick={handleSave}
            disabled={saving}
            className="text-xs h-12 px-6"
          >
            <Save className={`w-3.5 h-3.5 mr-2 ${saving ? "animate-spin" : ""}`} />
            Save Profile
          </Button>
        </div>
      </div>

      {/* Stored Resume File Pill */}
      {resumeFilePath && (
        <div className="flex items-center justify-between p-4 rounded-none border border-[#303132] bg-[#131415] text-xs">
          <div className="flex items-center gap-3 text-white font-medium">
            <FileText className="w-4 h-4 text-[#CCF2DF]" />
            <span className="uppercase font-mono text-[11px] tracking-wider text-[#B8B9B9]">Master Resume Attached:</span>
            <span className="font-mono text-white text-[11px] truncate max-w-md">
              {resumeFilePath.split(/[\\/]/).pop()}
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#CCF2DF] bg-[#CCF2DF]/10 px-2.5 py-1 rounded-none border border-[#CCF2DF]/30">
            Active in Playwright
          </span>
        </div>
      )}

      {/* Tabs — Aronya geometric precision */}
      <div className="flex items-center gap-2.5 border-b border-[#303132] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2.5 rounded-[8px] text-xs font-mono uppercase tracking-wider transition-all border-2 ${
            activeTab === "profile"
              ? "border-white text-white font-semibold"
              : "border-transparent text-[#B8B9B9] hover:text-white hover:border-[#303132]"
          }`}
        >
          Basic Info & Target Roles
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("experience")}
          className={`px-4 py-2.5 rounded-[8px] text-xs font-mono uppercase tracking-wider transition-all border-2 ${
            activeTab === "experience"
              ? "border-white text-white font-semibold"
              : "border-transparent text-[#B8B9B9] hover:text-white hover:border-[#303132]"
          }`}
        >
          Work & Education ({experience.length + education.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("screening")}
          className={`px-4 py-2.5 rounded-[8px] text-xs font-mono uppercase tracking-wider transition-all border-2 ${
            activeTab === "screening"
              ? "border-white text-white font-semibold"
              : "border-transparent text-[#B8B9B9] hover:text-white hover:border-[#303132]"
          }`}
        >
          Screening Memory Bank
        </button>
      </div>

      {/* TAB 1: Profile & Skills */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Contact Details */}
          <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-5">
            <h2 className="text-xs uppercase font-mono tracking-widest text-white border-b border-[#303132] pb-3">
              Contact & Identification
            </h2>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nikhil Sharma"
                className="text-xs sm:text-sm h-11 bg-[#141516]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nikhil@example.com"
                  className="text-xs sm:text-sm h-11 bg-[#141516]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="text-xs sm:text-sm h-11 bg-[#141516]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Location (City, Country)</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bengaluru, India"
                className="text-xs sm:text-sm h-11 bg-[#141516]"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase font-mono text-[#B8B9B9]">LinkedIn</Label>
                <Input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="text-xs h-10 bg-[#141516]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] uppercase font-mono text-[#B8B9B9]">GitHub</Label>
                <Input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="text-xs h-10 bg-[#141516]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] uppercase font-mono text-[#B8B9B9]">Portfolio</Label>
                <Input
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://myportfolio.dev"
                  className="text-xs h-10 bg-[#141516]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Executive Summary / Bio</Label>
              <Textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Computer Science senior with extensive experience in Next.js, Node.js, and GenAI workflows..."
                className="text-xs sm:text-sm bg-[#141516] leading-relaxed"
              />
            </div>
          </div>

          {/* Skills & Target Roles */}
          <div className="space-y-8">
            {/* Skills */}
            <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-4">
              <div className="flex items-center justify-between border-b border-[#303132] pb-3">
                <h2 className="text-xs uppercase font-mono tracking-widest text-white">
                  Candidate Skills ({skills.length})
                </h2>
                <span className="text-[10px] text-[#B8B9B9] font-mono">Used for % match scoring</span>
              </div>

              <div className="flex items-center gap-3">
                <Input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                  placeholder="Add skill (e.g. Python, Docker, Next.js)"
                  className="text-xs h-10 bg-[#141516]"
                />
                <Button size="default" onClick={addSkill} className="text-xs h-10 px-4">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 max-h-56 overflow-y-auto">
                {skills.length === 0 ? (
                  <p className="text-xs text-[#B8B9B9] font-light italic">No skills configured. Add skills above.</p>
                ) : (
                  skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none text-xs font-mono uppercase tracking-wider bg-[#262728] border border-[#303132] text-white hover:border-[#CCF2DF] transition-colors"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="text-[#B8B9B9] hover:text-rose-400 p-0.5 ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Target Search Roles */}
            <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-4">
              <div className="flex items-center justify-between border-b border-[#303132] pb-3">
                <h2 className="text-xs uppercase font-mono tracking-widest text-white">
                  Target Role Queries
                </h2>
                <span className="text-[10px] text-[#B8B9B9] font-mono">Searched on job boards</span>
              </div>

              <div className="flex items-center gap-3">
                <Input
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRole())}
                  placeholder="Add target role (e.g. AI Engineer Intern)"
                  className="text-xs h-10 bg-[#141516]"
                />
                <Button size="default" onClick={addRole} className="text-xs h-10 px-4">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {targetRoles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none text-xs font-mono uppercase tracking-wider border border-[#CCF2DF]/40 bg-[#CCF2DF]/10 text-[#CCF2DF]"
                  >
                    {role}
                    <button
                      type="button"
                      onClick={() => removeRole(role)}
                      className="text-[#CCF2DF] hover:text-rose-400 p-0.5 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Experience & Education */}
      {activeTab === "experience" && (
        <div className="space-y-8">
          {/* Work Experience Section */}
          <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-5">
            <div className="flex items-center justify-between border-b border-[#303132] pb-4">
              <div>
                <h2 className="text-xs uppercase font-mono tracking-widest text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#CCF2DF]" />
                  Work Experience ({experience.length})
                </h2>
                <p className="text-xs text-[#B8B9B9] font-light mt-1">
                  Grounded in LLM cover letter weaving and form questionnaire answering.
                </p>
              </div>

              <Button size="sm" variant="outline" onClick={addExperience} className="text-xs h-9 px-4">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Position
              </Button>
            </div>

            <div className="space-y-4">
              {experience.length === 0 ? (
                <p className="text-xs text-[#B8B9B9] font-light italic py-8 text-center">
                  No experience records parsed yet. Click Add Position or upload a PDF resume.
                </p>
              ) : (
                experience.map((exp, idx) => (
                  <div key={idx} className="p-5 rounded-none border border-[#303132] bg-[#141516] space-y-4">
                    <div className="flex items-center justify-between border-b border-[#303132]/60 pb-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-white">
                        Position #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeExperience(idx)}
                        className="text-[#B8B9B9] hover:text-rose-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase font-mono text-[#B8B9B9]">Role / Title</Label>
                        <Input
                          value={exp.role}
                          onChange={(e) => updateExperience(idx, "role", e.target.value)}
                          placeholder="Software Engineering Intern"
                          className="text-xs h-10 bg-[#131415]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase font-mono text-[#B8B9B9]">Company</Label>
                        <Input
                          value={exp.company}
                          onChange={(e) => updateExperience(idx, "company", e.target.value)}
                          placeholder="Google / Acme Corp"
                          className="text-xs h-10 bg-[#131415]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase font-mono text-[#B8B9B9]">Duration</Label>
                        <Input
                          value={exp.duration}
                          onChange={(e) => updateExperience(idx, "duration", e.target.value)}
                          placeholder="May 2024 - Aug 2024"
                          className="text-xs h-10 bg-[#131415]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] uppercase font-mono text-[#B8B9B9]">
                        Responsibilities & Tech Stack
                      </Label>
                      <Textarea
                        rows={2}
                        value={exp.description}
                        onChange={(e) => updateExperience(idx, "description", e.target.value)}
                        placeholder="Built real-time messaging pipeline using Kafka and Go. Reduced latency by 35%..."
                        className="text-xs bg-[#131415]"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Education Section */}
          <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-5">
            <div className="flex items-center justify-between border-b border-[#303132] pb-4">
              <div>
                <h2 className="text-xs uppercase font-mono tracking-widest text-white flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#CCF2DF]" />
                  Education History ({education.length})
                </h2>
                <p className="text-xs text-[#B8B9B9] font-light mt-1">Degrees, institutions, and graduation batches.</p>
              </div>

              <Button size="sm" variant="outline" onClick={addEducation} className="text-xs h-9 px-4">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Degree
              </Button>
            </div>

            <div className="space-y-4">
              {education.length === 0 ? (
                <p className="text-xs text-[#B8B9B9] font-light italic py-8 text-center">
                  No education records parsed yet.
                </p>
              ) : (
                education.map((edu, idx) => (
                  <div key={idx} className="p-5 rounded-none border border-[#303132] bg-[#141516] space-y-4">
                    <div className="flex items-center justify-between border-b border-[#303132]/60 pb-2">
                      <span className="text-xs font-mono uppercase tracking-wider text-white">
                        Degree #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEducation(idx)}
                        className="text-[#B8B9B9] hover:text-rose-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase font-mono text-[#B8B9B9]">Degree / Major</Label>
                        <Input
                          value={edu.degree}
                          onChange={(e) => updateEducation(idx, "degree", e.target.value)}
                          placeholder="B.S. in Computer Science"
                          className="text-xs h-10 bg-[#131415]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase font-mono text-[#B8B9B9]">University / College</Label>
                        <Input
                          value={edu.institution}
                          onChange={(e) => updateEducation(idx, "institution", e.target.value)}
                          placeholder="Stanford / IIT / BITS"
                          className="text-xs h-10 bg-[#131415]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase font-mono text-[#B8B9B9]">Graduation Period</Label>
                        <Input
                          value={edu.year}
                          onChange={(e) => updateEducation(idx, "year", e.target.value)}
                          placeholder="2025"
                          className="text-xs h-10 bg-[#131415]"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Screening Q&A Memory Bank */}
      {activeTab === "screening" && (
        <div className="p-6 rounded-none border border-[#303132] bg-[#131415] space-y-6">
          <div className="border-b border-[#303132] pb-4">
            <h2 className="text-xs uppercase font-mono tracking-widest text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#CCF2DF]" />
              Verified Screening Facts & Defaults
            </h2>
            <p className="text-xs text-[#B8B9B9] font-light mt-1 leading-relaxed">
              These verified candidate answers are injected automatically during LinkedIn and Internshala application modals, replacing destructive blind "1" or "Yes" stuffing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Graduation Batch / Year</Label>
              <Input
                value={screeningDefaults.graduationYear || ""}
                onChange={(e) =>
                  setScreeningDefaults((prev) => ({ ...prev, graduationYear: e.target.value }))
                }
                placeholder="2025"
                className="text-xs sm:text-sm h-11 bg-[#141516]"
              />
              <span className="text-[10px] text-[#B8B9B9] font-light">Used for graduation year screening fields.</span>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Current CGPA / GPA (Out of 10 or 4.0)</Label>
              <Input
                value={screeningDefaults.gpa || ""}
                onChange={(e) => setScreeningDefaults((prev) => ({ ...prev, gpa: e.target.value }))}
                placeholder="8.8 / 10"
                className="text-xs sm:text-sm h-11 bg-[#141516]"
              />
              <span className="text-[10px] text-[#B8B9B9] font-light">Fills numeric GPA fields accurately.</span>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Notice Period / Availability</Label>
              <Input
                value={screeningDefaults.noticePeriodDays || ""}
                onChange={(e) =>
                  setScreeningDefaults((prev) => ({ ...prev, noticePeriodDays: e.target.value }))
                }
                placeholder="Immediately available / 0 days"
                className="text-xs sm:text-sm h-11 bg-[#141516]"
              />
              <span className="text-[10px] text-[#B8B9B9] font-light">Answers notice period / start date questions.</span>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Expected Monthly Stipend</Label>
              <Input
                value={screeningDefaults.expectedStipend || ""}
                onChange={(e) =>
                  setScreeningDefaults((prev) => ({ ...prev, expectedStipend: e.target.value }))
                }
                placeholder="₹25,000 / Negotiable"
                className="text-xs sm:text-sm h-11 bg-[#141516]"
              />
              <span className="text-[10px] text-[#B8B9B9] font-light">Filled on Internshala stipend expectation inputs.</span>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Work Authorization Status</Label>
              <Input
                value={screeningDefaults.workAuthorization || ""}
                onChange={(e) =>
                  setScreeningDefaults((prev) => ({ ...prev, workAuthorization: e.target.value }))
                }
                placeholder="Authorized to work without sponsorship"
                className="text-xs sm:text-sm h-11 bg-[#141516]"
              />
              <span className="text-[10px] text-[#B8B9B9] font-light">Prevents false sponsorship radio selections.</span>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-mono text-[#B8B9B9]">Relocation Willingness</Label>
              <Input
                value={screeningDefaults.relocationWillingness || ""}
                onChange={(e) =>
                  setScreeningDefaults((prev) => ({ ...prev, relocationWillingness: e.target.value }))
                }
                placeholder="Yes, open to relocation / Remote preferred"
                className="text-xs sm:text-sm h-11 bg-[#141516]"
              />
              <span className="text-[10px] text-[#B8B9B9] font-light">Answers relocation screening questions.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
