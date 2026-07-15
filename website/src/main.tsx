import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarClock,
  Check,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Loader2,
  LogIn,
  Mail,
  Menu,
  MessageSquareText,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import './styles.css';

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  features: string[];
  studentLimit: number;
  teacherLimit: number;
  trialDays: number;
};

type DemoForm = {
  name: string;
  email: string;
  phone: string;
  schoolName: string;
  studentCount: string;
  staffCount: string;
  message: string;
};

const DEFAULT_API_BASE = import.meta.env.PROD ? 'https://api.akademifyy.in/api/v1' : 'http://localhost:4000/api/v1';
const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '');
const LOGIN_URL = 'https://app.akademifyy.in/';

const defaultPlans: Plan[] = [
  {
    id: 'starter-local',
    name: 'Starter',
    priceCents: 299900,
    features: ['Attendance and timetable', 'Student records', 'Basic fee tracking', 'Email support'],
    studentLimit: 500,
    teacherLimit: 40,
    trialDays: 0,
  },
  {
    id: 'standard-local',
    name: 'Standard',
    priceCents: 599900,
    features: ['Everything in Starter', 'Exams and marks', 'Parent portal', 'Reports and analytics'],
    studentLimit: 1500,
    teacherLimit: 120,
    trialDays: 0,
  },
  {
    id: 'premium-local',
    name: 'Premium',
    priceCents: 999900,
    features: ['Everything in Standard', 'Advanced permissions', 'Multi-branch readiness', 'Priority onboarding'],
    studentLimit: 5000,
    teacherLimit: 400,
    trialDays: 0,
  },
];

const initialForm: DemoForm = {
  name: '',
  email: '',
  phone: '',
  schoolName: '',
  studentCount: '',
  staffCount: '',
  message: '',
};

const formatCurrency = (priceCents: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(priceCents / 100));

const normalizePlanName = (name: string) =>
  name
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <GraduationCap size={22} />
    </span>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const nav = [
    ['Features', '#features'],
    ['Workflow', '#workflow'],
    ['Pricing', '#pricing'],
    ['Demo', '#demo'],
  ];

  return (
    <header className="site-header">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="Akademifyy home">
          <BrandMark />
          <span>Akademifyy</span>
        </a>
        <div className="nav-links">
          {nav.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <a className="login-link" href={LOGIN_URL}>
            <LogIn size={17} />
            Login
          </a>
          <a className="btn btn-primary" href="#demo">
            Book demo
          </a>
          <button
            className="nav-toggle"
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </nav>
      <div className={`mobile-menu ${open ? 'is-open' : ''}`}>
        {nav.map(([label, href]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
        <a href="/school-management-system/" onClick={() => setOpen(false)}>
          School management system
        </a>
        <a href="/school-erp/" onClick={() => setOpen(false)}>
          School ERP
        </a>
        <a href={LOGIN_URL} onClick={() => setOpen(false)}>
          Login
        </a>
        <a className="btn btn-primary" href="#demo" onClick={() => setOpen(false)}>
          Book demo
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={16} />
            School ERP for growing Indian institutions
          </div>
          <h1>School management software for focused daily operations.</h1>
          <p>
            Akademifyy gives school leaders in India a reliable school ERP for admissions, attendance, fees, exams,
            staff coordination, parent updates, reports, and student records.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#demo">
              Book a demo
              <ArrowRight size={18} />
            </a>
            <a className="btn btn-outline on-dark" href="#pricing">
              View plans
            </a>
          </div>
          <div className="hero-proof">
            <span>24-hour approved demo access</span>
            <span>Super-admin review</span>
            <span>Live plan pricing</span>
          </div>
        </div>
        <div className="dashboard-visual" aria-label="Akademifyy dashboard preview">
          <div className="visual-top">
            <span />
            <span />
            <span />
          </div>
          <div className="visual-grid">
            <div className="metric large">
              <LayoutDashboard size={22} />
              <strong>94%</strong>
              <span>Attendance today</span>
            </div>
            <div className="metric">
              <Users size={20} />
              <strong>1,248</strong>
              <span>Students</span>
            </div>
            <div className="metric">
              <Landmark size={20} />
              <strong>₹8.4L</strong>
              <span>Fees collected</span>
            </div>
            <div className="chart-panel">
              <div className="bar h1" />
              <div className="bar h2" />
              <div className="bar h3" />
              <div className="bar h4" />
              <div className="bar h5" />
            </div>
            <div className="notice-panel">
              <Bell size={18} />
              <span>Parent notice scheduled for Class X</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureSection() {
  const features = [
    {
      icon: <BookOpenCheck />,
      title: 'Academic records',
      body: 'Classes, sections, subjects, exams, marks, homework, and reports stay connected.',
    },
    {
      icon: <CalendarClock />,
      title: 'Attendance workflows',
      body: 'Student and staff attendance tools support daily operations and audit-friendly tracking.',
    },
    {
      icon: <Landmark />,
      title: 'Fee operations',
      body: 'Manage fee groups, invoices, collection, discounts, receipts, and ledgers.',
    },
    {
      icon: <MessageSquareText />,
      title: 'Parent communication',
      body: 'Keep parents informed through notices, portal access, and communication settings.',
    },
    {
      icon: <ShieldCheck />,
      title: 'Role-based access',
      body: 'Super admins and school admins can control module access with plan-aware permissions.',
    },
    {
      icon: <BarChart3 />,
      title: 'Operational visibility',
      body: 'Dashboards, analytics, support, audit logs, and reports help leadership act quickly.',
    },
  ];

  return (
    <section className="section" id="features">
      <div className="container">
        <div className="section-head">
          <span className="kicker">What it covers</span>
          <h2>Built for the work schools repeat every day.</h2>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <div className="icon-badge">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  const steps = [
    ['Submit details', 'A school shares contact details, student count, staff count, and notes.'],
    ['Admin review', 'The super admin reviews the request inside the admin panel.'],
    ['Approve request', 'Approval creates a 24-hour access token and sends the email.'],
    ['Run the demo', 'The school explores the platform with guidance from your team.'],
  ];

  return (
    <section className="section section-muted" id="workflow">
      <div className="container">
        <div className="section-head centered">
          <span className="kicker">Demo workflow</span>
          <h2>Every request has a clear approval path.</h2>
        </div>
        <div className="workflow-grid">
          {steps.map(([title, body], index) => (
            <article className="workflow-step" key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({
  plans,
  loading,
  error,
}: {
  plans: Plan[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <div className="section-head centered">
          <span className="kicker">Pricing</span>
          <h2>Plans loaded from your backend.</h2>
          <p>{error ? error : loading ? 'Loading current plans...' : 'Choose a plan and request a guided demo.'}</p>
        </div>
        <div className="pricing-grid">
          {plans.map((plan, index) => (
            <article className={`price-card ${index === 1 ? 'highlight' : ''}`} key={plan.id}>
              {index === 1 ? <span className="popular">Popular</span> : null}
              <h3>{normalizePlanName(plan.name)}</h3>
              <div className="price">
                <strong>{formatCurrency(plan.priceCents)}</strong>
                <span>/ month</span>
              </div>
              <p>
                Up to {plan.studentLimit.toLocaleString('en-IN')} students and{' '}
                {plan.teacherLimit.toLocaleString('en-IN')} staff.
              </p>
              <ul>
                {plan.features.slice(0, 5).map((feature) => (
                  <li key={feature}>
                    <Check size={17} />
                    {feature}
                  </li>
                ))}
              </ul>
              <a className="btn btn-outline" href="#demo">
                Book demo
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoFormSection() {
  const [form, setForm] = useState<DemoForm>(initialForm);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const update = (field: keyof DemoForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');

    try {
      const payload = {
        ...form,
        studentCount: Number(form.studentCount),
        staffCount: Number(form.staffCount),
      };
      const response = await fetch(`${API_BASE}/public/website/demo-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message ?? 'Unable to submit demo request');
      }

      setStatus('success');
      setMessage('Your demo request has been submitted. Our admin team will review it and email the approved access link.');
      setForm(initialForm);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to submit demo request');
    }
  };

  return (
    <section className="section demo-section" id="demo">
      <div className="container demo-grid">
        <div>
          <span className="kicker">Book a demo</span>
          <h2>Tell us about your school.</h2>
          <p>
            After submission, the request appears in the super-admin panel. Once approved, Akademifyy sends the contact
            a demo access link that is valid for 24 hours.
          </p>
          <div className="contact-panel">
            <div>
              <Mail size={18} />
              <span>Approval email is sent from your configured platform email provider.</span>
            </div>
            <div>
              <Phone size={18} />
              <span>Phone number helps your team schedule the walkthrough.</span>
            </div>
          </div>
        </div>

        <form className="demo-form" onSubmit={submit}>
          <div className="form-row">
            <label>
              Name
              <input value={form.name} onChange={(event) => update('name', event.target.value)} required minLength={2} />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              Phone
              <input value={form.phone} onChange={(event) => update('phone', event.target.value)} />
            </label>
            <label>
              School name
              <input
                value={form.schoolName}
                onChange={(event) => update('schoolName', event.target.value)}
                required
                minLength={2}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Number of students
              <input
                type="number"
                min="1"
                value={form.studentCount}
                onChange={(event) => update('studentCount', event.target.value)}
                required
              />
            </label>
            <label>
              Number of staffs
              <input
                type="number"
                min="1"
                value={form.staffCount}
                onChange={(event) => update('staffCount', event.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Notes
            <textarea value={form.message} onChange={(event) => update('message', event.target.value)} rows={4} />
          </label>
          <button className="btn btn-primary btn-wide" type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? <Loader2 className="spin" size={18} /> : null}
            Submit demo request
          </button>
          {message ? <p className={`form-message ${status}`}>{message}</p> : null}
        </form>
      </div>
    </section>
  );
}

function FaqSection() {
  const faqs = [
    {
      question: 'What is Akademifyy?',
      answer:
        'Akademifyy is school management software that helps institutions manage admissions, student records, attendance, fees, exams, reports, and communication from one web-based workspace.',
    },
    {
      question: 'Which school operations does Akademifyy support?',
      answer:
        'Akademifyy supports attendance workflows, academic records, exam and marks management, fee operations, parent communication, role-based access, analytics, and school administration reports.',
    },
    {
      question: 'Does Akademifyy include parent communication tools?',
      answer:
        'Yes. Akademifyy includes parent portal access and communication workflows so schools can share notices, updates, attendance information, and student progress with families.',
    },
    {
      question: 'How can a school try Akademifyy?',
      answer:
        'Schools can submit the demo form on the Akademifyy website. After admin approval, the school receives a demo access link that is valid for 24 hours.',
    },
  ];

  return (
    <section className="section section-muted" id="faq">
      <div className="container">
        <div className="section-head centered">
          <span className="kicker">FAQ</span>
          <h2>School ERP questions, answered directly.</h2>
        </div>
        <div className="faq-grid">
          {faqs.map((faq) => (
            <article className="faq-item" key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SeoLandingLinks() {
  const links = [
    {
      href: '/school-management-system/',
      title: 'School management system',
      body: 'Learn how Akademifyy supports student records, attendance, fees, exams, communication, and reports.',
    },
    {
      href: '/school-erp/',
      title: 'School ERP',
      body: 'Explore Akademifyy as a school ERP for academics, administration, accounts, and parent communication.',
    },
    {
      href: '/school-management-software/',
      title: 'School management software',
      body: 'See the everyday school software workflows available for admins, teachers, accountants, and parents.',
    },
    {
      href: '/academic-management-app/',
      title: 'Academic management app',
      body: 'Review academic workflows for timetable, attendance, homework, exams, marks, and results.',
    },
  ];

  return (
    <section className="section seo-links-section" aria-labelledby="seo-links-heading">
      <div className="container">
        <div className="section-head centered">
          <span className="kicker">Explore Akademifyy</span>
          <h2 id="seo-links-heading">School ERP and academic management resources.</h2>
          <p>
            Use these pages to understand how Akademifyy supports common school management software workflows.
          </p>
        </div>
        <div className="seo-link-grid">
          {links.map((link) => (
            <a className="seo-link-card" href={link.href} key={link.href}>
              <h3>{link.title}</h3>
              <p>{link.body}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <a className="brand" href="#top">
          <BrandMark />
          <span>Akademifyy</span>
        </a>
        <p>School management software for structured, visible, and accountable operations.</p>
        <div className="footer-links">
          <a href="/school-management-system/">School management system</a>
          <a href="/school-erp/">School ERP</a>
          <a href="/school-management-software/">School management software</a>
          <a href="/academic-management-app/">Academic management app</a>
          <a href={LOGIN_URL}>Login to app</a>
        </div>
      </div>
    </footer>
  );
}

function App() {
  const [plans, setPlans] = useState<Plan[]>(defaultPlans);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE}/public/website/plans`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Using fallback prices because the plans API is unavailable.');
        return response.json();
      })
      .then((data: { items?: Plan[] }) => {
        if (!mounted) return;
        if (data.items?.length) setPlans(data.items);
      })
      .catch((error) => {
        if (!mounted) return;
        setPlansError(error instanceof Error ? error.message : 'Unable to load current plans.');
      })
      .finally(() => {
        if (mounted) setPlansLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <FeatureSection />
        <WorkflowSection />
        <PricingSection
          plans={plans}
          loading={plansLoading}
          error={plansError}
        />
        <SeoLandingLinks />
        <FaqSection />
        <DemoFormSection />
      </main>
      <Footer />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
