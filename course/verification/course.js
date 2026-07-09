const MobileNav = {
  init() {
    const nav = document.getElementById('mobile-nav');
    const toggle = document.getElementById('nav-toggle');
    const close = document.getElementById('mobile-nav-close');

    const setOpen = open => {
      nav?.classList.toggle('active', open);
      toggle?.setAttribute('aria-expanded', String(open));
    };

    if (toggle && nav) {
      toggle.setAttribute('aria-controls', nav.id);
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle?.addEventListener('click', () => setOpen(true));
    close?.addEventListener('click', () => setOpen(false));
    nav?.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => setOpen(false))
    );
  }
};

const CourseProgress = {
  storageKey: 'caish-verification-course-progress',
  readings: [
    { id: 'unit-1-reading-1', unit: 1, reading: '1.1', title: 'AI “Stop Button” Problem', href: '/course/verification/1.html#read-1-1' },
    { id: 'unit-1-reading-2', unit: 1, reading: '1.2', title: 'The Hard Problem of Controlling Powerful AI Systems', href: '/course/verification/1.html#read-1-2' },
    { id: 'unit-1-reading-3', unit: 1, reading: '1.3', title: 'AI 2040: Plan A', href: '/course/verification/1.html#read-1-3' },
    { id: 'unit-1-reading-4', unit: 1, reading: '1.4', title: 'Risks from power-seeking AI', href: '/course/verification/1.html#read-1-4' },
    { id: 'unit-1-reading-5', unit: 1, reading: '1.5', title: 'Extreme power concentration', href: '/course/verification/1.html#read-1-5' },
    { id: 'unit-1-reading-6', unit: 1, reading: '1.6', title: 'Components of a frontier AI slowdown', href: '/course/verification/1.html#read-1-6' },
    { id: 'unit-1-reading-7', unit: 1, reading: '1.7', title: 'Avoiding an AI Arms Race with Assurance Technologies', href: '/course/verification/1.html#read-1-7' },
    { id: 'unit-1-reading-8', unit: 1, reading: '1.8', title: 'Computing Power and the Governance of Artificial Intelligence', href: '/course/verification/1.html#read-1-8' },
    { id: 'unit-1-reading-9', unit: 1, reading: '1.9', title: 'Verification Is a Ladder', href: '/course/verification/1.html#read-1-9' },
    { id: 'unit-1-reading-10', unit: 1, reading: '1.10', title: 'Nuclear Arms Control Verification and Lessons for AI Treaties', href: '/course/verification/1.html#read-1-10' },
    { id: 'unit-1-reading-11', unit: 1, reading: '1.11', title: 'Hardware-Enabled Mechanisms for Verifying Responsible AI Development', href: '/course/verification/1.html#read-1-11' },
    { id: 'unit-1-reading-12', unit: 1, reading: '1.12', title: 'Frontier AI Auditing', href: '/course/verification/1.html#read-1-12' },
    { id: 'unit-1-reading-13', unit: 1, reading: '1.13', title: 'Open Problems in Technical AI Governance', href: '/course/verification/1.html#read-1-13' },
    { id: 'unit-1-reading-14', unit: 1, reading: '1.14', title: 'Mechanisms to Verify International Agreements About AI Development', href: '/course/verification/1.html#read-1-14' },
    { id: 'unit-1-reading-15', unit: 1, reading: '1.15', title: 'Verification for International AI Governance', href: '/course/verification/1.html#read-1-15' },
    { id: 'unit-1-reading-16', unit: 1, reading: '1.16', title: 'Verifying International Agreements on AI', href: '/course/verification/1.html#read-1-16' },
    { id: 'unit-1-reading-17', unit: 1, reading: '1.17', title: 'Hardware-Level Governance of AI Compute', href: '/course/verification/1.html#read-1-17' },
    { id: 'unit-1-reading-18', unit: 1, reading: '1.18', title: 'On restraining AI development for the sake of safety', href: '/course/verification/1.html#read-1-18' },
    { id: 'unit-2-reading-1', unit: 2, reading: '2.1', title: 'A system overview for near-term, low-trust AI compute verification', href: '/course/verification/2.html#read-2-1' },
    { id: 'unit-2-reading-2', unit: 2, reading: '2.2', title: 'Secure, Governable Chips', href: '/course/verification/2.html#read-2-2' },
    { id: 'unit-2-reading-3', unit: 2, reading: '2.3', title: 'Flexible Hardware-Enabled Guarantees (flexHEG)', href: '/course/verification/2.html#read-2-3' },
    { id: 'unit-2-reading-4', unit: 2, reading: '2.4', title: 'Example Schemes for Verifying High-Stakes AI Agreements', href: '/course/verification/2.html#read-2-4' },
    { id: 'unit-2-reading-5', unit: 2, reading: '2.5', title: 'Trustless Audits without Revealing Data or Models', href: '/course/verification/2.html#read-2-5' },
    { id: 'unit-2-reading-6', unit: 2, reading: '2.6', title: 'Zero-knowledge verification for frontier AI training is possible', href: '/course/verification/2.html#read-2-6' },
    { id: 'unit-2-reading-7', unit: 2, reading: '2.7', title: 'The Fundamentals and Feasibility of Secure Network Taps', href: '/course/verification/2.html#read-2-7' },
    { id: 'unit-2-reading-8', unit: 2, reading: '2.8', title: 'What does it take to catch a Chinchilla? Verifying Rules on Large-Scale Neural Network Training', href: '/course/verification/2.html#read-2-8' },
    { id: 'unit-2-reading-9', unit: 2, reading: '2.9', title: 'Governing Through the Cloud: The Intermediary Role of Compute Providers in AI Regulation', href: '/course/verification/2.html#read-2-9' },
    { id: 'unit-2-reading-10', unit: 2, reading: '2.10', title: 'Attestable Audits: Verifiable AI Safety Benchmarks Using Trusted Execution Environments', href: '/course/verification/2.html#read-2-10' },
    { id: 'unit-3-reading-1', unit: 3, reading: '3.1', title: 'flexHEG', href: '/course/verification/3.html#read-3-1' },
    { id: 'unit-3-reading-2', unit: 3, reading: '3.2', title: 'Hardware-Enabled Governance Mechanisms', href: '/course/verification/3.html#read-3-2' },
    { id: 'unit-3-reading-3', unit: 3, reading: '3.3', title: 'Guaranteeable Memory: An HBM-Based Chiplet for Verifiable AI Workloads', href: '/course/verification/3.html#read-3-3' },
    { id: 'unit-3-reading-4', unit: 3, reading: '3.4', title: 'Guardain: Protecting Emerging Generative AI Workloads on Heterogeneous NPU', href: '/course/verification/3.html#read-3-4' },
    { id: 'unit-3-reading-5', unit: 3, reading: '3.5', title: 'On TEEs for Privacy-Preserving Monitoring in AI Governance', href: '/course/verification/3.html#read-3-5' },
    { id: 'unit-3-reading-6', unit: 3, reading: '3.6', title: 'Inference Verification in a TEE', href: '/course/verification/3.html#read-3-6' },
    { id: 'unit-3-reading-7', unit: 3, reading: '3.7', title: 'Verifying LLM Inference to Detect Model Weight Exfiltration', href: '/course/verification/3.html#read-3-7' },
    { id: 'unit-3-reading-8', unit: 3, reading: '3.8', title: 'DiFR: Inference Verification Despite Nondeterminism', href: '/course/verification/3.html#read-3-8' },
    { id: 'unit-3-reading-9', unit: 3, reading: '3.9', title: 'AI 2040: Verification Plan', href: '/course/verification/3.html#read-3-9' },
    { id: 'unit-3-reading-10', unit: 3, reading: '3.10', title: 'Efficient Zero-Knowledge Proofs for AI Inference', href: '/course/verification/3.html#read-3-10' },
    { id: 'unit-3-reading-11', unit: 3, reading: '3.11', title: 'Verifiable evaluations of machine learning models using zkSNARKs', href: '/course/verification/3.html#read-3-11' },
    { id: 'unit-3-reading-12', unit: 3, reading: '3.12', title: 'zkLLM: Zero Knowledge Proofs for Large Language Models', href: '/course/verification/3.html#read-3-12' },
    { id: 'unit-3-reading-13', unit: 3, reading: '3.13', title: 'ZKML: An Optimizing System for ML Inference in Zero-Knowledge Proofs', href: '/course/verification/3.html#read-3-13' },
    { id: 'unit-3-reading-14', unit: 3, reading: '3.14', title: 'Handling floating point in ZK inference verification', href: '/course/verification/3.html#read-3-14' },
    { id: 'unit-3-reading-15', unit: 3, reading: '3.15', title: 'Architecture-private Zero-knowledge Proof of Neural Networks', href: '/course/verification/3.html#read-3-15' },
    { id: 'unit-3-reading-16', unit: 3, reading: '3.16', title: 'NANOZK: Layerwise Zero-Knowledge Proofs for Verifiable LLM Inference', href: '/course/verification/3.html#read-3-16' },
    { id: 'unit-3-reading-17', unit: 3, reading: '3.17', title: 'Hollow-LLM Attack: Computationally Trivial Weights in Zero-Knowledge Verification of LLM Inference', href: '/course/verification/3.html#read-3-17' },
    { id: 'unit-3-reading-18', unit: 3, reading: '3.18', title: 'Physical Verification of AI Systems against Nation-state Adversaries', href: '/course/verification/3.html#read-3-18' },
    { id: 'unit-3-reading-19', unit: 3, reading: '3.19', title: 'Timing and Memory Telemetry on GPUs for AI Governance', href: '/course/verification/3.html#read-3-19' },
    { id: 'unit-3-reading-20', unit: 3, reading: '3.20', title: 'Network Traffic Hashing', href: '/course/verification/3.html#read-3-20' },
    { id: 'unit-3-reading-21', unit: 3, reading: '3.21', title: 'Software-Based Memory Erasure with relaxed isolation requirements', href: '/course/verification/3.html#read-3-21' },
    { id: 'unit-3-reading-22', unit: 3, reading: '3.22', title: 'Memory Wipes, a Performance Analysis', href: '/course/verification/3.html#read-3-22' },
    { id: 'unit-3-reading-23', unit: 3, reading: '3.23', title: 'Off-Chip Compute Verification', href: '/course/verification/3.html#read-3-23' },
    { id: 'unit-3-reading-24', unit: 3, reading: '3.24', title: '“Energon”: Unveiling Transformers from GPU Power and Thermal Side-Channels', href: '/course/verification/3.html#read-3-24' },
    { id: 'unit-3-reading-25', unit: 3, reading: '3.25', title: 'International Governance of Civilian AI: A Jurisdictional Certification Approach', href: '/course/verification/3.html#read-3-25' },
    { id: 'unit-3-reading-26', unit: 3, reading: '3.26', title: 'Verification Methods for International AI Agreements', href: '/course/verification/3.html#read-3-26' },
    { id: 'unit-3-reading-27', unit: 3, reading: '3.27', title: 'Tools for verifying neural models\' training data', href: '/course/verification/3.html#read-3-27' },
    { id: 'unit-4-reading-1', unit: 4, reading: '4.1', title: 'You Need a Theory of Victory', href: '/course/verification/4.html#read-4-1' },
    { id: 'unit-4-reading-2', unit: 4, reading: '4.2', title: 'My Research Process: Key Mindsets', href: '/course/verification/4.html#read-4-2' }
  ],

  init() {
    this.progressCount = document.getElementById('course-progress-count');
    this.progressFill = document.getElementById('course-progress-fill');
    this.startTitle = document.querySelector('.course-start-panel h2');
    this.nextUp = document.querySelector('.course-next-up');
    this.primaryAction = document.querySelector('.course-primary-action');
    this.completed = this.loadProgress();
    this.prepareReadings();
    this.renderProgress();

    window.addEventListener('storage', event => {
      if (event.key !== this.storageKey) return;
      this.completed = this.loadProgress();
      this.renderProgress();
    });
  },

  loadProgress() {
    try {
      return new Set(JSON.parse(localStorage.getItem(this.storageKey) || '[]'));
    } catch (error) {
      return new Set();
    }
  },

  saveProgress() {
    localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.completed)));
  },

  prepareReadings() {
    const readings = Array.from(document.querySelectorAll('.course-reading'));
    readings.forEach(reading => {
      const id = reading.dataset.readingId;
      if (!id) return;
      const meta = reading.querySelector('.course-reading-meta');
      if (!meta || reading.querySelector('.course-done-toggle')) return;

      const status = document.createElement('div');
      status.className = 'course-reading-status';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'course-done-toggle';
      button.dataset.readingToggle = id;
      button.addEventListener('click', () => this.toggleReading(id));

      status.append(meta, button);
      reading.insertBefore(status, reading.firstChild);

      const title = reading.querySelector('.course-reading-main h3')?.textContent.trim();
      reading.querySelectorAll('.course-reading-link[target="_blank"]').forEach(link => {
        if (!link.getAttribute('aria-label') && title) {
          link.setAttribute('aria-label', 'Open external link for ' + title);
        }
      });
    });
  },

  toggleReading(id) {
    const added = !this.completed.has(id);
    if (added) this.completed.add(id);
    else this.completed.delete(id);
    this.saveProgress();
    this.renderProgress();
    // If signed in, mirror the change to the account. No-op when signed out.
    CourseAuth.pushToggle(id, added);
  },

  renderProgress() {
    const allCourseReadings = this.readings.map(reading => reading.id);
    const completedCount = allCourseReadings.filter(id => this.completed.has(id)).length;

    if (this.progressCount) {
      this.progressCount.textContent = String(completedCount);
    }
    if (this.progressFill) {
      this.progressFill.style.width = Math.round((completedCount / allCourseReadings.length) * 100) + '%';
    }
    document.querySelectorAll('.course-done-toggle').forEach(button => {
      const done = this.completed.has(button.dataset.readingToggle);
      button.setAttribute('aria-pressed', done ? 'true' : 'false');
      button.textContent = done ? 'Done' : 'Mark done';
    });

    document.querySelectorAll('.course-lesson').forEach(link => {
      const href = link.getAttribute('href') || '';
      const ids = (link.dataset.readingIds || '').split(/\s+/).filter(Boolean);
      const match = href.match(/#read-(\d+)-(\d+)/);
      if (!ids.length && match) ids.push('unit-' + match[1] + '-reading-' + match[2]);
      if (!ids.length) return;

      const complete = ids.every(id => this.completed.has(id));
      const started = !complete && ids.some(id => this.completed.has(id));
      link.classList.toggle('is-complete', complete);
      link.classList.toggle('is-started', started);
    });
    this.renderNextUp(completedCount);
  },

  renderNextUp(completedCount) {
    const next = this.readings.find(reading => !this.completed.has(reading.id));
    const unitLabel = next ? String(next.unit).padStart(2, '0') : '04';

    if (this.startTitle) {
      if (next) {
        this.startTitle.textContent = completedCount ? 'Continue with Unit ' + unitLabel : 'Begin with Unit ' + unitLabel;
      } else {
        this.startTitle.textContent = 'Readings complete';
      }
    }

    if (this.nextUp) {
      const label = this.nextUp.querySelector('span');
      const title = this.nextUp.querySelector('strong');
      const meta = this.nextUp.querySelector('small');

      this.nextUp.href = next ? next.href : '/course/verification/4.html';
      if (label) label.textContent = 'Next up';
      if (title) title.textContent = next ? next.title : 'Project ideation';
      if (meta) meta.textContent = next ? 'Unit ' + unitLabel + ' · Reading ' + next.reading : 'Unit 04 · Prompts';
    }

    if (this.primaryAction) {
      this.primaryAction.href = next ? '/course/verification/' + next.unit + '.html' : '/course/verification/4.html';
      this.primaryAction.textContent = next
        ? (completedCount ? 'Continue Unit ' : 'Start Unit ') + unitLabel
        : 'Open Unit 04';
    }

    this.syncOpenModule(next ? next.unit : 4);
  },

  syncOpenModule(unit) {
    const modules = Array.from(document.querySelectorAll('.course-module'));
    if (!modules.length) return;

    modules.forEach(module => {
      const number = Number((module.querySelector('.course-module-num')?.textContent || '').trim());
      if (!number) return;
      module.open = number === unit;
    });
  }
};

// Optional sign-in so progress follows a user across devices. Everything here is
// additive: if the library or config is missing, or the network fails, the course
// runs exactly as it does signed out, on localStorage alone.
const CourseAuth = {
  nameKey: 'caish-verification-ws-name',
  courseId: 'verification',
  client: null,
  session: null,
  box: null,
  mergedKey: 'caish-verification-merged',
  outboxKey: 'caish-verification-sync-outbox',
  activeUserKey: 'caish-verification-active-user',

  init() {
    if (!window.supabase || !window.CAISH_SUPABASE_URL || !window.CAISH_SUPABASE_ANON_KEY) return;
    try {
      this.client = window.supabase.createClient(window.CAISH_SUPABASE_URL, window.CAISH_SUPABASE_ANON_KEY, {
        auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
      });
    } catch (error) {
      this.client = null;
      return;
    }

    this.mountUI();

    this.client.auth.getSession().then(({ data }) => {
      this.session = (data && data.session) || null;
      this.renderUI();
      this.notifyAuthChange();
      if (this.session) this.reconcile();
      if (location.hash.includes('access_token') || location.search.includes('code=')) {
        history.replaceState(null, '', location.pathname);
      }
    }).catch(() => {});

    this.client.auth.onAuthStateChange((event, session) => {
      this.session = session || null;
      this.renderUI();
      this.notifyAuthChange();
      if (session && event === 'SIGNED_IN') this.reconcile();
    });

    window.addEventListener('online', () => this.flushOutbox());
  },

  user() {
    return this.session && this.session.user;
  },

  displayName(user) {
    const u = user || this.user();
    if (!u) return '';
    const meta = u.user_metadata || {};
    let stored = '';
    try { stored = localStorage.getItem(this.nameKey) || ''; } catch (error) {}
    return (meta.full_name || meta.name || stored || u.email || '').trim();
  },

  notifyAuthChange() {
    if (!document.dispatchEvent) return;
    try {
      document.dispatchEvent(new CustomEvent('course-auth-change', {
        detail: { signedIn: Boolean(this.user()) }
      }));
    } catch (error) {
      document.dispatchEvent(new Event('course-auth-change'));
    }
  },

  // Bring local and remote progress into agreement. First time on this browser
  // we union (so progress made before signing in is kept and pushed up). After
  // that the account wins, so an unmark on another device propagates here.
  async reconcile() {
    if (!this.user()) return;
    try {
      const hadPending = this.hasOutbox();
      if (hadPending && !(await this.flushOutbox())) return;

      const remote = await this.fetchRemote();
      if (remote === null) return;
      const userId = this.user().id;
      const previousUserId = localStorage.getItem(this.activeUserKey);
      const changedUser = previousUserId && previousUserId !== userId;
      const merged = changedUser || localStorage.getItem(this.mergedStorageKey()) === 'true';

      if (!merged) {
        const local = new Set(CourseProgress.completed);
        const toPush = [...local].filter(id => !remote.has(id));
        const pushed = await this.upsertMany(toPush);
        this.apply(new Set([...local, ...remote]));
        if (pushed) localStorage.setItem(this.mergedStorageKey(), 'true');
      } else {
        this.apply(remote);
      }
    } catch (error) {
      // keep local; try again next load
    }
  },

  async fetchRemote() {
    try {
      const { data, error } = await this.client
        .from('course_progress')
        .select('reading_id')
        .eq('course_id', this.courseId);
      if (error) return null;
      return new Set(data.map(row => row.reading_id));
    } catch (error) {
      return null;
    }
  },

  async upsertMany(ids) {
    if (!ids.length) return true;
    const rows = ids.map(id => ({ course_id: this.courseId, reading_id: id }));
    try {
      const { error } = await this.client.from('course_progress').upsert(rows, {
        onConflict: 'user_id,course_id,reading_id',
        ignoreDuplicates: true
      });
      if (error) {
        ids.forEach(id => this.queue({ op: 'add', id }));
        return false;
      }
      return true;
    } catch (error) {
      ids.forEach(id => this.queue({ op: 'add', id }));
      return false;
    }
  },

  apply(set) {
    CourseProgress.completed = new Set(set);
    CourseProgress.saveProgress();
    CourseProgress.renderProgress();
    if (this.user()?.id) localStorage.setItem(this.activeUserKey, this.user().id);
  },

  async pushToggle(id, added) {
    if (!this.client || !this.user()) return;
    try {
      if (added) {
        const { error } = await this.client.from('course_progress').upsert(
          { course_id: this.courseId, reading_id: id },
          { onConflict: 'user_id,course_id,reading_id', ignoreDuplicates: true }
        );
        if (error) this.queue({ op: 'add', id });
      } else {
        const { error } = await this.client.from('course_progress')
          .delete().eq('course_id', this.courseId).eq('reading_id', id);
        if (error) this.queue({ op: 'del', id });
      }
    } catch (error) {
      this.queue({ op: added ? 'add' : 'del', id });
    }
  },

  queue(item) {
    try {
      const outbox = JSON.parse(localStorage.getItem(this.outboxStorageKey()) || '[]')
        .filter(existing => existing.id !== item.id);
      outbox.push(item);
      localStorage.setItem(this.outboxStorageKey(), JSON.stringify(outbox));
    } catch (error) {}
  },

  hasOutbox() {
    try {
      return JSON.parse(localStorage.getItem(this.outboxStorageKey()) || '[]').length > 0;
    } catch (error) {
      return false;
    }
  },

  async flushOutbox() {
    if (!this.client || !this.user()) return true;
    let outbox;
    try {
      outbox = JSON.parse(localStorage.getItem(this.outboxStorageKey()) || '[]');
    } catch (error) {
      return false;
    }
    if (!outbox.length) return true;
    const remaining = [];
    for (const item of outbox) {
      try {
        let error;
        if (item.op === 'add') {
          ({ error } = await this.client.from('course_progress').upsert(
            { course_id: this.courseId, reading_id: item.id },
            { onConflict: 'user_id,course_id,reading_id', ignoreDuplicates: true }
          ));
        } else {
          ({ error } = await this.client.from('course_progress')
            .delete().eq('course_id', this.courseId).eq('reading_id', item.id));
        }
        if (error) remaining.push(item);
      } catch (e) {
        remaining.push(item);
      }
    }
    localStorage.setItem(this.outboxStorageKey(), JSON.stringify(remaining));
    return remaining.length === 0;
  },

  mergedStorageKey() {
    const id = this.user()?.id;
    return id ? this.mergedKey + ':' + id : this.mergedKey;
  },

  outboxStorageKey() {
    const id = this.user()?.id;
    return id ? this.outboxKey + ':' + id : this.outboxKey;
  },

  mountUI() {
    const host = document.querySelector('.course-start-panel') || document.querySelector('.course-progress-panel');
    if (!host) return;
    this.box = document.createElement('div');
    this.box.className = 'course-auth';
    this.box.id = 'course-auth';
    host.appendChild(this.box);
    this.renderUI();
  },

  renderUI() {
    if (!this.box) return;
    const user = this.user();
    const note = document.querySelector('.course-progress-note');
    if (note) {
      note.textContent = user
        ? 'Synced to your account.'
        : 'Saved in this browser.';
    }
    if (user) {
      this.box.innerHTML =
        '<p class="course-auth-status">Synced as ' + this.escape(this.displayName(user)) + '</p>' +
        '<button type="button" class="course-auth-link" id="course-signout">Sign out</button>';
      this.box.querySelector('#course-signout').addEventListener('click', () => this.signOut());
    } else {
      this.box.innerHTML =
        '<button type="button" class="course-auth-trigger" id="course-signin-trigger">' +
          '<svg class="course-auth-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>' +
          '<span>Sign in</span>' +
        '</button>' +
        '<form class="course-auth-form" id="course-auth-form" hidden>' +
          '<input class="course-auth-input" id="course-auth-name" type="text" required placeholder="Your name" aria-label="Your name" autocomplete="name">' +
          '<input class="course-auth-input" id="course-auth-email" type="email" required placeholder="you@example.com" aria-label="Email for your CAISH course sign-in link" autocomplete="email">' +
          '<button type="submit" class="course-auth-send">Send email link</button>' +
        '</form>' +
        '<p class="course-auth-msg" id="course-auth-msg" hidden></p>';
      const trigger = this.box.querySelector('#course-signin-trigger');
      const form = this.box.querySelector('#course-auth-form');
      trigger.addEventListener('click', () => {
        trigger.hidden = true;
        form.hidden = false;
        form.querySelector('input').focus();
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        this.sendLink(form.querySelector('#course-auth-email').value, form.querySelector('#course-auth-name').value);
      });
    }
  },

  async sendLink(email, name) {
    const msg = this.box.querySelector('#course-auth-msg');
    const form = this.box.querySelector('#course-auth-form');
    if (name) { try { localStorage.setItem(this.nameKey, name.trim()); } catch (error) {} }
    try {
      const { error } = await this.client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: location.origin + location.pathname,
          data: name ? { full_name: name.trim() } : undefined
        }
      });
      if (form) form.hidden = true;
      if (msg) {
        msg.hidden = false;
        msg.textContent = error
          ? ('Could not send the link. ' + error.message)
          : ('We sent a one-time sign-in link to ' + email + '.');
      }
    } catch (error) {
      if (msg) {
        msg.hidden = false;
        msg.textContent = 'Could not send the link. Please try again.';
      }
    }
  },

  async signOut() {
    try {
      await this.client.auth.signOut();
    } catch (error) {}
    this.session = null;
    this.renderUI();
    this.notifyAuthChange();
  },

  escape(value) {
    return String(value).replace(/[&<>"']/g, character => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
    ));
  }
};

const CourseModules = {
  init() {
    const modules = Array.from(document.querySelectorAll('.course-module'));
    modules.forEach(module => {
      module.addEventListener('toggle', () => {
        if (!module.open) return;
        modules.forEach(other => {
          if (other !== module) other.open = false;
        });
      });
    });
  }
};


const CourseWorksheet = {
  storageKey: 'caish-verification-worksheet',
  nameKey: 'caish-verification-ws-name',
  fields: [],
  nameField: null,
  nameRow: null,
  pushTimer: null,
  pulled: false,
  submitted: false,

  init() {
    const box = document.getElementById('course-worksheet');
    if (!box) return;
    this.fields = Array.from(box.querySelectorAll('textarea[data-ws]'));
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}'); } catch (error) {}
    this.fields.forEach(field => {
      if (saved[field.dataset.ws]) field.value = saved[field.dataset.ws];
      field.addEventListener('input', () => this.save());
    });
    const button = document.getElementById('course-ws-pdf');
    if (button) button.addEventListener('click', () => this.pdf(this.fields));
    const copy = document.getElementById('course-ws-copy');
    if (copy) copy.addEventListener('click', () => this.copySketch(this.fields));
    this.nameField = document.getElementById('course-ws-name');
    this.nameRow = document.getElementById('course-ws-name-row');
    if (this.nameField) {
      this.nameField.value = localStorage.getItem(this.nameKey) || '';
      this.nameField.addEventListener('input', () => {
        try { localStorage.setItem(this.nameKey, this.nameField.value); } catch (error) {}
      });
    }
    const submit = document.getElementById('course-ws-submit');
    if (submit) submit.addEventListener('click', () => this.submit());
    this.renderFoot();
    document.addEventListener('course-auth-change', () => {
      this.pull();
      this.renderFoot();
    });
    if (CourseAuth.client) {
      CourseAuth.client.auth.onAuthStateChange(() => { this.pull(); this.renderFoot(); });
    }
  },

  renderFoot() {
    const authBox = document.getElementById('course-ws-auth');
    const submit = document.getElementById('course-ws-submit');
    const status = document.getElementById('course-ws-status');
    if (!authBox || !submit) return;
    const user = CourseAuth.client && CourseAuth.user();
    this.renderNameField(Boolean(user));
    if (user) {
      authBox.hidden = true;
      authBox.innerHTML = '';
      submit.hidden = false;
      if (status && !this.submitted) status.textContent = 'Submitting as ' + user.email + '. Saves as you type.';
    } else {
      submit.hidden = true;
      authBox.hidden = false;
      if (status) status.textContent = 'Sign in above to submit. Answers still save in this browser.';
      authBox.innerHTML =
        '<p class="course-sketch-note">Sign in to submit your sketch to the organising team.</p>' +
        '<form class="course-auth-form" id="course-ws-signin">' +
          '<input class="course-auth-input" id="course-ws-signin-name" type="text" required placeholder="Your name" aria-label="Your name" autocomplete="name">' +
          '<input class="course-auth-input" id="course-ws-signin-email" type="email" required placeholder="you@example.com" aria-label="Email for your sign-in link" autocomplete="email">' +
          '<button type="submit" class="course-auth-send">Send sign-in link</button>' +
        '</form>' +
        '<p class="course-auth-msg" id="course-ws-signin-msg" hidden></p>';
      authBox.querySelector('#course-ws-signin').addEventListener('submit', async event => {
        event.preventDefault();
        const email = authBox.querySelector('#course-ws-signin-email').value;
        const nameVal = authBox.querySelector('#course-ws-signin-name').value;
        const msg = authBox.querySelector('#course-ws-signin-msg');
        if (nameVal) { try { localStorage.setItem(this.nameKey, nameVal.trim()); } catch (error) {} }
        try {
          const { error } = await CourseAuth.client.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: location.origin + location.pathname,
              data: nameVal ? { full_name: nameVal.trim() } : undefined
            }
          });
          msg.hidden = false;
          msg.textContent = error ? ('Could not send the link. ' + error.message) : ('We sent a one-time sign-in link to ' + email + '.');
        } catch (error) {
          msg.hidden = false;
          msg.textContent = 'Could not send the link. Please try again.';
        }
      });
    }
  },

  renderNameField(isSignedIn) {
    if (this.nameRow) this.nameRow.hidden = isSignedIn;
    if (this.nameField) this.nameField.required = !isSignedIn;
  },

  displayName() {
    const user = CourseAuth.user();
    if (user) {
      const meta = user.user_metadata || {};
      return String(meta.full_name || meta.name || user.email || '').trim();
    }
    return this.nameField ? this.nameField.value.trim() : '';
  },

  async submit() {
    const status = document.getElementById('course-ws-status');
    const name = this.displayName();
    const answers = this.data();
    if (!answers.q1 || !answers.q1.trim()) { status.textContent = 'Fill in at least question 1.'; return; }
    if (!CourseAuth.session) { status.textContent = 'Sign in first.'; return; }
    if (!name) { status.textContent = 'Could not identify your account. Sign in again.'; return; }
    status.textContent = 'Submitting...';
    try {
      const response = await fetch('/.netlify/functions/sketch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + CourseAuth.session.access_token
        },
        body: JSON.stringify({ name, answers })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Could not submit.');
      this.submitted = true;
      status.textContent = 'Submitted. You can revise and resubmit until 16 August.';
      document.getElementById('course-ws-submit').textContent = 'Resubmit sketch';
    } catch (error) {
      status.textContent = (error.message || 'Could not submit.') + ' If this persists, email hello@caish.org.';
    }
  },

  data() {
    const data = {};
    this.fields.forEach(field => { data[field.dataset.ws] = field.value; });
    return data;
  },

  save() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.data())); } catch (error) {}
    if (!CourseAuth.client || !CourseAuth.user()) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.push(), 1500);
  },

  async push() {
    try {
      await CourseAuth.client.from('project_sketches').upsert({
        course_id: CourseAuth.courseId,
        worksheet: this.data(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,course_id' });
    } catch (error) {}
  },

  // fill empty local fields from the account copy; local text always wins
  async pull() {
    if (this.pulled || !CourseAuth.user()) return;
    this.pulled = true;
    try {
      const { data, error } = await CourseAuth.client
        .from('project_sketches')
        .select('worksheet')
        .eq('course_id', CourseAuth.courseId)
        .maybeSingle();
      if (error || !data || !data.worksheet) return;
      this.fields.forEach(field => {
        const remote = data.worksheet[field.dataset.ws];
        if (remote && !field.value.trim()) field.value = remote;
      });
      try { localStorage.setItem(this.storageKey, JSON.stringify(this.data())); } catch (error) {}
    } catch (error) {}
  },

  worksheetEntries(fields) {
    return fields.map(field => ({
      question: field.closest('.course-ws-item').querySelector('.course-ws-q').textContent.trim(),
      answer: field.value.trim()
    }));
  },

  sheetText(fields) {
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const name = this.displayName();
    const lines = ['Project sketch', 'AI Assurance course, Cambridge AI Safety Hub. ' + date];
    if (name) lines.push(name);
    lines.push('');
    this.worksheetEntries(fields).forEach(entry => {
      lines.push(entry.question);
      lines.push(entry.answer || '(not answered)');
      lines.push('');
    });
    return lines.join('\n').trim() + '\n';
  },

  sheetHTML(fields) {
    const esc = value => CourseAuth.escape(value);
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const name = this.displayName();
    const sections = this.worksheetEntries(fields).map(entry => {
      const answer = entry.answer || '(not answered)';
      return '<h2>' + esc(entry.question) + '</h2><p style="white-space:pre-wrap">' + esc(answer) + '</p>';
    }).join('');
    return '<h1>Project sketch' + (name ? ' - ' + esc(name) : '') + '</h1>'
      + '<p>AI Assurance course, Cambridge AI Safety Hub. ' + date + '</p>' + sections;
  },

  copySketch(fields) {
    const status = document.getElementById('course-ws-status');
    const button = document.getElementById('course-ws-copy');
    const plain = this.sheetText(fields);
    const html = this.sheetHTML(fields);
    this.hideCopyBox();
    // path 1: synchronous rich-text copy (keeps user activation alive)
    let copied = false;
    try {
      const holder = document.createElement('div');
      holder.setAttribute('contenteditable', 'true');
      holder.style.position = 'fixed';
      holder.style.left = '-9999px';
      holder.innerHTML = html;
      document.body.appendChild(holder);
      const range = document.createRange();
      range.selectNodeContents(holder);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      copied = document.execCommand('copy');
      selection.removeAllRanges();
      holder.remove();
    } catch (error) {}
    // path 2: async clipboard as backup, fire-and-forget
    if (!copied && navigator.clipboard) {
      try {
        if (window.ClipboardItem && navigator.clipboard.write) {
          navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' })
          })]).catch(() => {});
        } else if (navigator.clipboard.writeText) {
          navigator.clipboard.writeText(plain).catch(() => {});
        }
        copied = true;
      } catch (error) {}
    }
    if (copied) {
      if (button) button.textContent = 'Copied';
      if (status) status.textContent = 'Copied. Paste it into a Google Doc, or anywhere else.';
      setTimeout(() => { if (button) button.textContent = 'Copy sketch'; }, 4000);
    } else {
      this.showCopyBox(plain);
      if (status) status.textContent = 'Copy blocked. Select the text below and copy it manually.';
    }
  },

  hideCopyBox() {
    const box = document.getElementById('course-ws-copybox');
    if (!box) return;
    box.hidden = true;
    box.value = '';
  },

  showCopyBox(text) {
    const box = document.getElementById('course-ws-copybox');
    if (!box) return;
    box.value = text;
    box.hidden = false;
    box.focus();
    box.select();
  },

  copyWithTextarea(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) throw new Error('copy failed');
  },

  pdf(fields) {
    const esc = value => CourseAuth.escape(value);
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const name = this.displayName();
    const sections = this.worksheetEntries(fields).map(entry => {
      const answer = entry.answer
        ? '<p class="a">' + esc(entry.answer) + '</p>'
        : '<div class="blank"></div>';
      return '<div class="q">' + esc(entry.question) + '</div>' + answer;
    }).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write('<!DOCTYPE html><html><head><title>Project sketch</title><style>'
      + '@page{margin:0}'
      + 'body{font-family:Georgia,serif;color:#1a1a1a;margin:0;padding:20mm 22mm;line-height:1.55}'
      + 'h1{font-size:21px;font-weight:400;margin:0}'
      + '.meta{color:#8a8a84;font-size:11px;margin:6px 0 0;padding-bottom:14px;border-bottom:1px solid #ddd}'
      + '.q{font-size:12.5px;font-weight:700;margin:22px 0 6px;max-width:620px}'
      + '.a{font-size:13px;margin:0;white-space:pre-wrap;max-width:620px}'
      + '.blank{height:52px;border-bottom:1px solid #ddd;max-width:620px}'
      + '</style></head><body>'
      + '<h1>Project sketch' + (name ? ' &middot; ' + esc(name) : '') + '</h1>'
      + '<p class="meta">AI Assurance course, Cambridge AI Safety Hub &middot; ' + date + '</p>'
      + sections + '</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }
};

function initAll() {
  MobileNav.init();
  CourseProgress.init();
  CourseAuth.init();
  CourseWorksheet.init();
  CourseModules.init();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initAll)
  : initAll();
