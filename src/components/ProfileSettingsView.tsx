import React, { useState } from 'react';
import {
  User,
  Briefcase,
  Target,
  Award,
  Globe,
  Flame,
  Save,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { UserPerformanceProfile } from '../types';
import { saveProfile } from '../lib/storage';
import { PWAInstallButton } from './PWAInstallButton';

interface ProfileSettingsViewProps {
  profile: UserPerformanceProfile;
  onUpdateProfile: (p: UserPerformanceProfile) => void;
}

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  profile,
  onUpdateProfile,
}) => {
  const [targetRole, setTargetRole] = useState(profile.targetRole || 'Software Engineer');
  const [experienceLevel, setExperienceLevel] = useState(profile.experienceLevel || '1-3 years');
  const [targetCompanies, setTargetCompanies] = useState(
    profile.targetCompanies?.join(', ') || 'Google, Meta, OpenAI, Stripe'
  );
  const [weakestSkill, setWeakestSkill] = useState(profile.weakestSkill || 'Confidence Under Pressure');
  const [strongestSkill, setStrongestSkill] = useState(profile.strongestSkill || 'Technical Knowledge');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = () => {
    const updated: UserPerformanceProfile = {
      ...profile,
      targetRole,
      experienceLevel,
      targetCompanies: targetCompanies.split(',').map((s) => s.trim()).filter(Boolean),
      weakestSkill,
      strongestSkill,
    };
    saveProfile(updated);
    onUpdateProfile(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleResetData = () => {
    if (window.confirm('Reset all training telemetry and local scores back to default baseline?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-stone-400 font-semibold text-xs uppercase tracking-wider">
          <User className="w-4 h-4 text-emerald-400" />
          <span>Personalization & Goals</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Plus_Jakarta_Sans'] mt-1">
          Profile & Target Persona
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Calibrate interview evaluation strictness, AI interviewer personas, and daily training curriculum based on your career targets.
        </p>
      </div>

      <div className="rounded-2xl bg-stone-900 border border-stone-800 p-6 sm:p-8 space-y-6 shadow-xl">
        {/* Target Role */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-400" />
            <span>Target Role</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              'Software Engineer',
              'AI/ML Engineer',
              'GenAI Engineer',
              'Backend Developer',
              'Full Stack Developer',
              'Senior SDE',
            ].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTargetRole(r)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  targetRole === r
                    ? 'bg-indigo-500 text-stone-950 font-bold shadow-sm'
                    : 'bg-stone-950 border border-stone-800 text-stone-300 hover:border-stone-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Experience Level */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-teal-400" />
            <span>Experience Level</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {['Student / Fresh Grad', '1-3 years', '3-5 years', 'Senior (5+ years)'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setExperienceLevel(lvl)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  experienceLevel === lvl
                    ? 'bg-teal-500 text-stone-950 font-bold shadow-sm'
                    : 'bg-stone-950 border border-stone-800 text-stone-300 hover:border-stone-700'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Target Companies */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-400" />
            <span>Target Companies (Comma separated)</span>
          </label>
          <input
            type="text"
            value={targetCompanies}
            onChange={(e) => setTargetCompanies(e.target.value)}
            placeholder="e.g. Google, Anthropic, Meta, Stripe, Databricks"
            className="w-full px-4 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Self-reported Weakest & Strongest */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4" />
              <span>Primary Focus (Weakest Area)</span>
            </label>
            <select
              value={weakestSkill}
              onChange={(e) => setWeakestSkill(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="Confidence Under Pressure">Confidence Under Pressure</option>
              <option value="Speaking Fluency & Fillers">Speaking Fluency & Fillers</option>
              <option value="English Grammar & Word Choice">English Grammar & Word Choice</option>
              <option value="Technical Explanation Depth">Technical Explanation Depth</option>
              <option value="Answer Structure (STAR / Context-Action)">Answer Structure</option>
              <option value="HR / Behavioral Questions">HR / Behavioral Questions</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4" />
              <span>Current Strongest Area</span>
            </label>
            <select
              value={strongestSkill}
              onChange={(e) => setStrongestSkill(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="Technical Knowledge">Technical Knowledge</option>
              <option value="Pronunciation & Clarity">Pronunciation & Clarity</option>
              <option value="Problem Solving & Algorithms">Problem Solving & Algorithms</option>
              <option value="Speaking Fluency">Speaking Fluency</option>
            </select>
          </div>
        </div>

        {/* Action buttons */}
        <div className="pt-4 border-t border-stone-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetData}
            id="btn-reset-app-data"
            className="inline-flex items-center gap-2 text-xs text-rose-400 hover:text-rose-300 font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Local App Data</span>
          </button>

          <div className="flex items-center gap-3">
            {savedNotice && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Profile Saved</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              id="btn-save-profile"
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-950 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>
      </div>

      {/* PWA / App Installation Card */}
      <PWAInstallButton variant="settings" />
    </div>
  );
};
