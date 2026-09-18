/**
 * Runkaro — demo data seeder.
 * Runs once on a fresh database; creates the demo admin + student
 * plus a few sample courses and tutorials so the site is never empty.
 *
 *   Demo admin  : admin@runkaro.com   / Admin@123
 *   Demo student: student@runkaro.com / Student@123
 */
const bcrypt = require('bcryptjs');
const dbSvc = require('./db');

function seed() {
  const db = dbSvc.get();
  let changed = false;

  // Credentials can be overridden with env vars: ADMIN_EMAIL, ADMIN_PASSWORD,
  // STUDENT_EMAIL, STUDENT_PASSWORD (e.g. set them on Render's dashboard).
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@runkaro.com').toLowerCase();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
  const STUDENT_EMAIL = (process.env.STUDENT_EMAIL || 'student@runkaro.com').toLowerCase();
  const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD || 'Student@123';


  if (db.users.length === 0) {
    const now = new Date().toISOString();
    db.users.push(
      {
        id: dbSvc.nextId('user'),
        name: 'Demo Admin',
        email: ADMIN_EMAIL,
        passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
        role: 'admin',
        status: 'active',
        createdAt: now,
      },
      {
        id: dbSvc.nextId('user'),
        name: 'Demo Student',
        email: STUDENT_EMAIL,
        passwordHash: bcrypt.hashSync(STUDENT_PASSWORD, 10),
        role: 'user',
        status: 'active',
        createdAt: now,
      }
    );
    changed = true;
    console.log(`[seed] Created accounts — admin: ${ADMIN_EMAIL} · student: ${STUDENT_EMAIL} (override with ADMIN_EMAIL/ADMIN_PASSWORD env vars)`);
  }

  if (db.courses.length === 0) {
    const admin = db.users.find((u) => u.role === 'admin');
    const courses = [
      {
        title: 'Modern JavaScript from Zero',
        description:
          'Master the fundamentals of modern JavaScript — variables, functions, arrays, objects, DOM manipulation and async programming — with hands-on examples in every lesson.',
        category: 'Web Development',
        level: 'Beginner',
        duration: '6h 20m',
        price: 0,
      },
      {
        title: 'React Masterclass: Build Real Apps',
        description:
          'Go from components to complete applications. Hooks, routing, state management, performance and deployment — everything you need to ship production React apps.',
        category: 'Web Development',
        level: 'Intermediate',
        duration: '8h 45m',
        price: 29,
      },
      {
        title: 'UI/UX Design Essentials',
        description:
          'Learn the principles of great interface design: layout, typography, color, the glassmorphism trend, prototyping and usability testing — no prior experience required.',
        category: 'Design',
        level: 'Beginner',
        duration: '4h 10m',
        price: 19,
      },
      {
        title: 'Node.js API Engineering',
        description:
          'Design and build robust REST APIs with Node.js and Express: routing, authentication, validation, file uploads, error handling and deployment best practices.',
        category: 'Backend',
        level: 'Intermediate',
        duration: '5h 30m',
        price: 24,
      },
    ];
    for (const c of courses) {
      db.courses.push({
        id: dbSvc.nextId('course'),
        ...c,
        thumbnail: '',
        createdBy: admin.id,
        createdAt: new Date().toISOString(),
      });
    }
    changed = true;
    console.log('[seed] Created 4 sample courses.');
  }

  if (db.tutorials.length === 0) {
    const admin = db.users.find((u) => u.role === 'admin');
    const tutorials = [
      {
        title: 'JavaScript Full Course for Beginners',
        description:
          'A complete beginner-friendly walkthrough of JavaScript — perfect companion to the Modern JavaScript course.',
        category: 'Programming',
        level: 'Beginner',
        duration: '3h 26m',
        videoUrl: 'https://www.youtube.com/watch?v=PkZNo7MFNFg',
      },
      {
        title: 'JavaScript Tutorial for Beginners (Crash Course)',
        description:
          'Quick crash course covering the core building blocks of the language in under an hour.',
        category: 'Programming',
        level: 'Beginner',
        duration: '1h 12m',
        videoUrl: 'https://www.youtube.com/watch?v=W6NZfCO5SIk',
      },
      {
        title: 'React Quick Start: Build Your First App',
        description:
          'Set up a React project and build your first component-driven app step by step.',
        category: 'Web Development',
        level: 'Beginner',
        duration: '1h 30m',
        videoUrl: 'https://www.youtube.com/watch?v=SqcY0GlETPk',
      },
      {
        title: 'Python Programming Fundamentals',
        description:
          'Variables, loops, functions and more — the foundations of Python for absolute beginners.',
        category: 'Programming',
        level: 'Beginner',
        duration: '4h 26m',
        videoUrl: 'https://www.youtube.com/watch?v=rfscVS0vtbw',
      },
    ];
    for (const t of tutorials) {
      db.tutorials.push({
        id: dbSvc.nextId('tut'),
        ...t,
        videoFile: '',
        thumbnail: '',
        createdBy: admin.id,
        createdAt: new Date().toISOString(),
      });
    }
    changed = true;
    console.log('[seed] Created 4 sample tutorials.');
  }

  if (changed) dbSvc.save();
}

module.exports = { seed };
