const MobileNav = {
  init() {
    const nav = document.getElementById('mobile-nav');
    const toggle = document.getElementById('nav-toggle');
    const close = document.getElementById('mobile-nav-close');
    toggle?.addEventListener('click', () => nav?.classList.add('active'));
    close?.addEventListener('click', () => nav?.classList.remove('active'));
    nav?.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => nav.classList.remove('active'))
    );
  }
};

const CourseProgress = {
  storageKey: 'caish-verification-course-progress',

  init() {
    this.progressCount = document.getElementById('course-progress-count');
    this.completed = this.loadProgress();
    this.prepareReadings();
    this.renderProgress();
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
    });
  },

  toggleReading(id) {
    if (this.completed.has(id)) this.completed.delete(id);
    else this.completed.add(id);
    this.saveProgress();
    this.renderProgress();
  },

  renderProgress() {
    const allCourseReadings = [
      'unit-1-reading-1', 'unit-1-reading-2', 'unit-1-reading-3', 'unit-1-reading-4',
      'unit-2-reading-1', 'unit-2-reading-2', 'unit-2-reading-3', 'unit-2-reading-4', 'unit-2-reading-5', 'unit-2-reading-6', 'unit-2-reading-7',
      'unit-3-reading-1', 'unit-3-reading-2', 'unit-3-reading-3', 'unit-3-reading-4', 'unit-3-reading-5', 'unit-3-reading-6', 'unit-3-reading-7', 'unit-3-reading-8', 'unit-3-reading-9', 'unit-3-reading-10', 'unit-3-reading-11', 'unit-3-reading-12', 'unit-3-reading-13', 'unit-3-reading-14', 'unit-3-reading-15', 'unit-3-reading-16', 'unit-3-reading-17', 'unit-3-reading-18', 'unit-3-reading-19', 'unit-3-reading-20', 'unit-3-reading-21', 'unit-3-reading-22', 'unit-3-reading-23'
    ];
    const completedCount = allCourseReadings.filter(id => this.completed.has(id)).length;

    if (this.progressCount) {
      this.progressCount.textContent = completedCount + ' / ' + allCourseReadings.length;
    }
    document.querySelectorAll('.course-done-toggle').forEach(button => {
      const done = this.completed.has(button.dataset.readingToggle);
      button.setAttribute('aria-pressed', done ? 'true' : 'false');
      button.textContent = done ? 'Done' : 'Mark done';
    });

    document.querySelectorAll('.course-lesson').forEach(link => {
      const href = link.getAttribute('href') || '';
      const match = href.match(/#read-(\d+)-(\d+)/);
      if (!match) return;
      link.classList.toggle('is-complete', this.completed.has('unit-' + match[1] + '-reading-' + match[2]));
    });
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

function initAll() {
  MobileNav.init();
  CourseProgress.init();
  CourseModules.init();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initAll)
  : initAll();
