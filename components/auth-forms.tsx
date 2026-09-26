"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Camera, ChevronLeft, ArrowRight, User } from "lucide-react";
import { Alert, Spinner } from "@/components/ui";
import { PasswordField } from "@/components/password-field";
import { GENDERS } from "@/lib/profile";

/**
 * Tag the destination so the welcome card knows to celebrate rather than ask
 * what you came for. Cheaper than a cookie, and it clears itself on dismiss.
 */
function withWelcome(next: string, kind: "signup" | "login") {
  return `${next}${next.includes("?") ? "&" : "?"}welcome=${kind}`;
}
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not sign you in.");
      router.push(withWelcome(next, "login"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-7">
      <h1 className="text-3xl">Welcome back</h1>
      <p className="mt-2 text-sm text-ink/65">Sign in to see your bookings, orders and coaching sessions.</p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="l-email">Email</label>
          <input id="l-email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <PasswordField
          id="l-pass"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
      </div>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-volt mt-6 w-full">
        {busy ? <Spinner /> : null} {busy ? "Signing in…" : "Sign in"}
      </button>

      <p className="mt-5 text-center text-sm text-ink/55">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-volt-deep hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-ink/45">
        You don&apos;t need an account to book a game or shop — it just keeps everything in one place.
      </p>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  // Step 1: Credentials | Step 2: Profiling Questions
  const [step, setStep] = useState<1 | 2>(1);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");

  // Profiling states
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [duprId, setDuprId] = useState("");
  const [dupr, setDupr] = useState("");
  const [city, setCity] = useState("Kolkata");

  // Avatar states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived rating
  const rating = Number(dupr);
  const hasRating = dupr.trim() !== "" && Number.isFinite(rating);
  const ratingOutOfRange = hasRating && (rating < 2 || rating > 8);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Please choose a photo under 3 MB.");
      return;
    }
    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setError(null);
  }

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please check and re-type.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit Indian WhatsApp mobile number.");
      return;
    }

    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("Please enter your full name (compulsory).");
      return;
    }
    const numAge = Number(age);
    if (!age || !Number.isFinite(numAge) || numAge < 5 || numAge > 120) {
      setError("Please enter a valid age between 5 and 120 (compulsory).");
      return;
    }
    if (!gender) {
      setError("Please select your sex (compulsory).");
      return;
    }
    if (ratingOutOfRange) {
      setError("DUPR ratings run between 2.0 and 8.0.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.replace(/\D/g, ""),
          password,
          age: numAge,
          gender,
          dupr_id: duprId.trim() || undefined,
          dupr: hasRating ? rating : null,
          city: city.trim() || "Kolkata",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create your account.");

      // If user uploaded a profile photo, upload it now with the active session
      if (avatarFile) {
        try {
          const body = new FormData();
          body.append("file", avatarFile);
          await fetch("/api/player/avatar", { method: "POST", body });
        } catch (avatarErr) {
          console.warn("Avatar upload deferred:", avatarErr);
        }
      }

      router.push(withWelcome(next, "signup"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="card p-7">
      {/* Progress tracker */}
      <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-volt-deep">
            {step === 1 ? "Step 1 of 2: Login Details" : "Step 2 of 2: Basic Profiling"}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {step === 1 ? "Join Sparvic" : "Complete Your Profile"}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`h-2.5 w-8 rounded-full transition-all ${step >= 1 ? "bg-volt" : "bg-line"}`} />
          <div className={`h-2.5 w-8 rounded-full transition-all ${step === 2 ? "bg-volt" : "bg-line"}`} />
        </div>
      </div>

      {step === 1 ? (
        /* STEP 1: Email, Password, WhatsApp Number */
        <form onSubmit={handleNextStep}>
          <p className="text-sm text-ink/65 mb-6">
            Enter your email and choose a password to get started. In the next step, you will set up your player profile.
          </p>

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="s-email">
                Email Address <span className="text-signal">*</span>
              </label>
              <input
                id="s-email"
                type="email"
                autoComplete="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="s-phone">
                WhatsApp Mobile Number <span className="text-signal">*</span>
              </label>
              <input
                id="s-phone"
                type="tel"
                inputMode="numeric"
                className="field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <p className="mt-1 text-[11px] text-ink/45">Booking confirmations and court numbers are sent on WhatsApp.</p>
            </div>

            <PasswordField
              id="s-pass"
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              required
              minLength={8}
              hint="Minimum 8 characters."
            />

            <PasswordField
              id="s-confirm-pass"
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              required
              minLength={8}
              error={
                confirmPassword.length > 0 && confirmPassword !== password
                  ? "The two passwords do not match."
                  : null
              }
            />
          </div>

          {error && (
            <div className="mt-5">
              <Alert>{error}</Alert>
            </div>
          )}

          <button type="submit" className="btn-volt mt-6 w-full flex items-center justify-center gap-2">
            Continue to Profile <ArrowRight size={16} />
          </button>

          <p className="mt-5 text-center text-sm text-ink/55">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-volt-deep hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      ) : (
        /* STEP 2: Profiling Questions (Name, Age, Sex, Photo, DUPR) */
        <form onSubmit={handleSubmit}>
          <p className="text-sm text-ink/65 mb-6">
            Basic profiling helps match you with court slots, player ratings, and tournament draws.
          </p>

          <div className="space-y-5">
            {/* Profile Photo Upload */}
            <div className="flex items-center gap-4 p-4 rounded-xl border border-line bg-mist/30">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-line bg-paper flex items-center justify-center">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <User size={28} className="text-ink/35" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Profile Photo</p>
                <p className="text-[11px] text-ink/50 mb-2">Optional. Shows on court rosters and leaderboards.</p>
                <label className="btn-outline btn-sm cursor-pointer inline-flex items-center gap-1.5 text-xs py-1 px-3">
                  <Camera size={13} />
                  {avatarPreview ? "Change Photo" : "Upload Photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                </label>
              </div>
            </div>

            {/* Name (Compulsory) */}
            <div>
              <label className="label" htmlFor="s-name">
                Full Name <span className="text-signal">* (Compulsory)</span>
              </label>
              <input
                id="s-name"
                className="field"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
              />
            </div>

            {/* Age & Sex Row (Both Compulsory) */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="s-age">
                  Age <span className="text-signal">* (Compulsory)</span>
                </label>
                <input
                  id="s-age"
                  type="number"
                  min="5"
                  max="120"
                  className="field"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                />
                <p className="mt-1 text-[11px] text-ink/45">Used for age-category draws &amp; games.</p>
              </div>

              <div>
                <label className="label" htmlFor="s-gender">
                  Sex <span className="text-signal">* (Compulsory)</span>
                </label>
                <select
                  id="s-gender"
                  className="field cursor-pointer"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                >
                  <option value="">Choose sex…</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-ink/45">Required for tournament divisions.</p>
              </div>
            </div>

            {/* DUPR ID & DUPR Level/Rating */}
            <div className="rounded-xl border border-line p-4 space-y-4 bg-mist/20">
              <div>
                <p className="text-sm font-semibold text-ink">DUPR Profile (Pickleball Rating)</p>
                <p className="text-[11px] text-ink/50">
                  If you have a DUPR profile, enter your ID and rating. If you are new, leave them blank.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="s-duprid">
                    DUPR ID
                  </label>
                  <input
                    id="s-duprid"
                    className="field font-mono uppercase tracking-wider"
                    value={duprId}
                    onChange={(e) => setDuprId(e.target.value.toUpperCase())}
                   
                    autoCapitalize="characters"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="s-dupr">
                    DUPR Level / Rating
                  </label>
                  <input
                    id="s-dupr"
                    className="field"
                    inputMode="decimal"
                    value={dupr}
                    onChange={(e) => setDupr(e.target.value)}
                   
                  />
                  {ratingOutOfRange && (
                    <p className="mt-1 text-[11px] text-signal font-medium">Ratings must be between 2.0 and 8.0</p>
                  )}
                </div>
              </div>

              {hasRating && !ratingOutOfRange && (
                <div className="flex items-center gap-2 pt-1 text-xs text-ink/65">
                  <span>Assigned Level:</span>
                  <span className="font-semibold text-volt-deep">
                    {rating < 3.0
                      ? "Beginner (< 3.0)"
                      : rating < 3.75
                      ? "Intermediate (3.0 – 3.75)"
                      : rating < 4.5
                      ? "Advanced (3.75 – 4.5)"
                      : "Pro (4.5+)"}
                  </span>
                </div>
              )}
            </div>

            {/* City */}
            <div>
              <label className="label" htmlFor="s-city">City</label>
              <input
                id="s-city"
                className="field"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="mt-5">
              <Alert>{error}</Alert>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep(1);
              }}
              disabled={busy}
              className="btn-outline flex items-center gap-1 py-3 px-4 text-xs font-semibold"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn-volt flex-1 py-3 flex items-center justify-center gap-2"
            >
              {busy ? <Spinner /> : null}
              {busy ? "Creating account…" : "Join Sparvic"}
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-ink/45">
            You can view and edit all your profile details anytime from your account dashboard.
          </p>
        </form>
      )}
    </div>
  );
}
