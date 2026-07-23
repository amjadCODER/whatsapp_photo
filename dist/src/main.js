import { createQueue, fillTemplate, queueStats } from './core.js';

let xlsxLoaderPromise = null;

function loadExcelLibrary() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxLoaderPromise) return xlsxLoaderPromise;

  xlsxLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.async = true;
    script.onload = () => window.XLSX
      ? resolve(window.XLSX)
      : reject(new Error('تعذر تشغيل مكتبة Excel'));
    script.onerror = () => reject(new Error('تعذر تحميل مكتبة Excel تحقق من اتصال الانترنت ثم حاول مرة ثانية'));
    document.head.appendChild(script);
  });

  return xlsxLoaderPromise;
}

const ACCESS_CODE = '0000';
const state = {
  authorized: sessionStorage.getItem('wa_access') === '1',
  queue: JSON.parse(localStorage.getItem('wa_queue') || '[]'),
  message: localStorage.getItem('wa_message') || '',
  countryCode: localStorage.getItem('wa_country') || '966',
  currentIndex: Number(localStorage.getItem('wa_current') || 0),
  imageName: localStorage.getItem('wa_image_name') || '',
  imageFile: null,
  notifications: localStorage.getItem('wa_notifications') !== '0',
  sound: localStorage.getItem('wa_sound') !== '0',
};

const app = document.querySelector('#app');

function save() {
  localStorage.setItem('wa_queue', JSON.stringify(state.queue));
  localStorage.setItem('wa_message', state.message);
  localStorage.setItem('wa_country', state.countryCode);
  localStorage.setItem('wa_current', String(state.currentIndex));
  localStorage.setItem('wa_image_name', state.imageName);
  localStorage.setItem('wa_notifications', state.notifications ? '1' : '0');
  localStorage.setItem('wa_sound', state.sound ? '1' : '0');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


function isGoogleChrome() {
  const userAgent = navigator.userAgent;
  return /Chrome|Chromium/.test(userAgent) && !/Edg|OPR|SamsungBrowser/.test(userAgent);
}

function extensionPing(timeout = 1800) {
  return new Promise((resolve) => {
    let completed = false;

    const handler = (event) => {
      if (
        event.source !== window ||
        event.data?.type !== "WA_EXTENSION_RESPONSE" ||
        !["PING", "READY"].includes(event.data.action)
      ) return;

      completed = true;
      window.removeEventListener("message", handler);
      resolve({
        installed: Boolean(event.data.ok),
        version: event.data.version || null
      });
    };

    window.addEventListener("message", handler);
    window.postMessage({ type: "WA_SITE_PING_EXTENSION" }, "*");

    setTimeout(() => {
      if (completed) return;
      window.removeEventListener("message", handler);
      resolve({ installed: false, version: null });
    }, timeout);
  });
}

function extensionPrepare(payload, timeout = 60000) {
  return new Promise((resolve, reject) => {
    let completed = false;

    const handler = (event) => {
      if (
        event.source !== window ||
        event.data?.type !== "WA_EXTENSION_RESPONSE" ||
        event.data.action !== "PREPARE"
      ) return;

      completed = true;
      window.removeEventListener("message", handler);

      if (event.data.ok) resolve(event.data);
      else reject(new Error(event.data.error || "تعذر تجهيز الرسالة عبر الإضافة"));
    };

    window.addEventListener("message", handler);
    window.postMessage({
      type: "WA_SITE_PREPARE_MESSAGE",
      payload
    }, "*");

    setTimeout(() => {
      if (completed) return;
      window.removeEventListener("message", handler);
      reject(new Error("لم تستجب إضافة Chrome"));
    }, timeout);
  });
}

function fileToDataUrl(file) {
  if (!file) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.readAsDataURL(file);
  });
}

function render() {
  if (!state.authorized) return renderLogin();
  const stats = queueStats(state.queue);
  const progress = stats.total ? Math.round((stats.sent / stats.total) * 100) : 0;
  const current = state.queue[state.currentIndex];

  app.innerHTML = `
    <main class="page-shell">
      <header class="topbar">
        <span class="connection"><i></i> متصل</span>
        <div class="brand"><span>WhatsApp Sender</span><b></b></div>
      </header>

      <section class="stats-grid" aria-label="احصائيات الحملة">
        ${statCard('المتبقي', stats.remaining)}
        ${statCard('تم الارسال', stats.sent)}
        ${statCard('اجمالي الارقام', stats.total)}
      </section>

      <section class="upload-box" id="dropZone" tabindex="0">
        <input id="excelInput" type="file" accept=".xlsx,.xls,.csv" hidden>
        <div>
          <strong>${state.queue.length ? 'تم تجهيز ملف جهات الاتصال' : 'رفع ملف Excel لجهات الاتصال'}</strong>
          <small>${state.queue.length ? `${state.queue.length} رسالة جاهزة داخل الطابور` : 'حمل النموذج ثم اكتب الاسماء والارقام وارفعه هنا'}</small>
        </div>
        <div class="upload-actions">
          <a class="mini-btn secondary" href="./نموذج-جهات-الاتصال.xlsx" download>تحميل النموذج</a>
          <button class="mini-btn" id="chooseExcel">اختيار الملف</button>
        </div>
      </section>

      <section class="message-box">
        <div class="message-heading">
          <div>
            <strong>اكتب الرسالة وارفق الصورة هنا</strong>
            <small>يمكن استخدام متغيرات مثل {الاسم} او {الجهة}</small>
          </div>
          <label class="mini-btn file-label">ارفاق صورة<input id="imageInput" type="file" accept="image/*" hidden></label>
        </div>
        <textarea id="messageInput" placeholder="اكتب نص الرسالة هنا">${escapeHtml(state.message)}</textarea>
        <div class="message-meta">
          <span>${state.imageName ? `الصورة المختارة ${escapeHtml(state.imageName)}` : 'لا توجد صورة مرفقة'}</span>
          <label>كود الدولة <input id="countryInput" value="${escapeHtml(state.countryCode)}" inputmode="numeric" maxlength="5"></label>
        </div>
      </section>

      <section class="settings-panel">
        <label><input id="notificationToggle" type="checkbox" ${state.notifications ? 'checked' : ''}> اشعارات عند تجهيز كل رسالة</label>
        <label><input id="soundToggle" type="checkbox" ${state.sound ? 'checked' : ''}> صوت تنبيه</label>
        <button id="enableNotifications" class="link-btn">تفعيل اذن الاشعارات</button>
      </section>

      <section class="queue-panel">
        <div class="queue-title">
          <div><strong>طابور الارسال</strong><small>${current ? `الرسالة الحالية ${Math.min(state.currentIndex + 1, state.queue.length)} من ${state.queue.length}` : 'ارفع ملف جهات الاتصال للبدء'}</small></div>
          <button class="link-btn" id="resetQueue" ${state.queue.length ? '' : 'disabled'}>مسح الطابور</button>
        </div>
        ${renderCurrent(current)}
      </section>

      <div class="progress-track" aria-label="نسبة تقدم الحملة">
        <span style="width:${progress}%"></span>
      </div>

      <button id="primaryAction" class="primary-action" ${current ? '' : 'disabled'}>
        ${current?.status === 'opened' ? 'تم الارسال وفتح التالي' : stats.sent > 0 ? 'فتح الرسالة الحالية' : 'بدء الحملة'}
      </button>
      <p class="helper-text">تجهز الرسائل كطابور وتفتح الرسالة التالية بعد اعتماد ارسال الرسالة الحالية</p>


      <section class="extension-card">
        <div class="extension-icon" aria-hidden="true">🧩</div>
        <div class="extension-body">
          <div class="extension-heading">
            <div>
              <strong>إضافة Google Chrome</strong>
              <small>يلزم استخدام Google Chrome وتفعيل الإضافة لتجهيز الصور داخل WhatsApp Web</small>
            </div>
            <span id="extensionStatus" class="extension-status">لم يتم الفحص</span>
          </div>
          <div class="extension-actions">
            <a class="mini-btn secondary" href="./whatsapp-sender-extension.zip" download>تحميل الإضافة</a>
            <button class="mini-btn" id="checkExtension">فحص الإضافة</button>
            <button class="mini-btn secondary" id="showExtensionGuide">طريقة التفعيل</button>
          </div>
          <div id="extensionGuide" class="extension-guide" hidden>
            <ol>
              <li>فك ضغط ملف الإضافة بعد تحميله</li>
              <li>افتح Google Chrome واكتب في شريط العنوان chrome://extensions</li>
              <li>فعل وضع المطور</li>
              <li>اضغط تحميل إضافة غير مضغوطة واختر مجلد الإضافة</li>
              <li>ثبت أيقونة الإضافة بجانب شريط العنوان</li>
              <li>ارجع إلى النظام واضغط فحص الإضافة</li>
            </ol>
          </div>
        </div>
      </section>

      <details class="instructions">
        <summary>تعليمات الاستخدام</summary>
        <ol>
          <li>اضغط تحميل النموذج واكتب الاسم ورقم الجوال والجهة دون تغيير عناوين الاعمدة</li>
          <li>ارفع الملف واكتب الرسالة ويمكن استخدام {الاسم} و {الجهة} داخل النص</li>
          <li>اضغط تفعيل اذن الاشعارات ثم وافق من المتصفح</li>
          <li>اضغط بدء الحملة لفتح الرسالة الحالية في واتساب ويب</li>
          <li>بعد ارسالها من واتساب ارجع للنظام واضغط تم الارسال وفتح التالي</li>
          <li>يحدث النظام اجمالي الارقام والمرسل والمتبقي تلقائيا</li>
        </ol>
        <p>عند تثبيت إضافة Google Chrome يتم تجهيز الصورة والنص داخل WhatsApp Web ثم يراجع المستخدم المحتوى ويضغط إرسال</p>
      </details>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </main>`;

  bindEvents();
}

function statCard(label, value) {
  return `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`;
}

function renderCurrent(current) {
  if (!current) return `<div class="empty-state">لا توجد رسائل مجهزة حاليا</div>`;
  const name = current.data.name ?? current.data['الاسم'] ?? current.data.organization ?? current.data['الجهة'] ?? 'جهة اتصال';
  const label = current.status === 'sent' ? 'تم الارسال' : current.status === 'opened' ? 'مفتوحة في واتساب' : 'بانتظار الارسال';
  return `<div class="current-card">
    <div><strong>${escapeHtml(name)}</strong><span dir="ltr">+${escapeHtml(current.phone)}</span></div>
    <em class="status-pill ${current.status}">${label}</em>
  </div>`;
}

function renderLogin() {
  app.innerHTML = `<main class="login-shell">
    <section class="login-card">
      <div class="brand large"><span>WhatsApp Sender</span><b></b></div>
      <h1>دخول المؤسسة</h1>
      <p>ادخل كود المؤسسة للمتابعة</p>
      <form id="loginForm">
        <input id="codeInput" type="password" inputmode="numeric" maxlength="12" placeholder="كود المؤسسة" autocomplete="one-time-code">
        <button>دخول</button>
      </form>
      <span class="login-note">استخدم كود المؤسسة المخصص للدخول</span>
    </section>
  </main>`;
  document.querySelector('#loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = document.querySelector('#codeInput').value.trim();
    if (value !== ACCESS_CODE) {
      document.querySelector('#codeInput').classList.add('error');
      document.querySelector('#codeInput').value = '';
      document.querySelector('#codeInput').placeholder = 'الكود غير صحيح';
      return;
    }
    sessionStorage.setItem('wa_access', '1');
    state.authorized = true;
    render();
  });
}

function bindEvents() {
  const excelInput = document.querySelector('#excelInput');
  document.querySelector('#chooseExcel').addEventListener('click', () => excelInput.click());
  document.querySelector('#dropZone').addEventListener('dblclick', () => excelInput.click());
  excelInput.addEventListener('change', readFile);

  const messageInput = document.querySelector('#messageInput');
  messageInput.addEventListener('input', () => { state.message = messageInput.value; save(); });

  document.querySelector('#countryInput').addEventListener('input', (event) => {
    state.countryCode = event.target.value.replace(/\D/g, '') || '966';
    event.target.value = state.countryCode;
    save();
  });

  document.querySelector('#imageInput').addEventListener('change', (event) => {
    state.imageFile = event.target.files?.[0] || null;
    state.imageName = state.imageFile?.name || '';
    save();
    render();
  });

  document.querySelector('#notificationToggle').addEventListener('change', (event) => {
    state.notifications = event.target.checked;
    save();
  });
  document.querySelector('#soundToggle').addEventListener('change', (event) => {
    state.sound = event.target.checked;
    save();
  });
  document.querySelector('#enableNotifications').addEventListener('click', enableNotifications);

  document.querySelector('#resetQueue').addEventListener('click', () => {
    if (!confirm('هل تريد مسح طابور الارسال الحالي؟')) return;
    state.queue = [];
    state.currentIndex = 0;
    save();
    render();
  });


  document.querySelector('#checkExtension').addEventListener('click', async () => {
    const status = document.querySelector('#extensionStatus');

    if (!isGoogleChrome()) {
      status.textContent = 'يجب استخدام Google Chrome';
      status.className = 'extension-status error';
      return;
    }

    status.textContent = 'جاري الفحص';
    status.className = 'extension-status';

    const result = await extensionPing();
    if (result.installed) {
      status.textContent = result.version ? `مفعلة إصدار ${result.version}` : 'الإضافة مفعلة';
      status.className = 'extension-status success';
    } else {
      status.textContent = 'غير مثبتة أو غير مفعلة';
      status.className = 'extension-status error';
    }
  });

  document.querySelector('#showExtensionGuide').addEventListener('click', () => {
    const guide = document.querySelector('#extensionGuide');
    guide.hidden = !guide.hidden;
  });

  document.querySelector('#primaryAction').addEventListener('click', processCurrent);
}

async function readFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const XLSX = await loadExcelLibrary();
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) throw new Error('ملف Excel فارغ');
    state.queue = createQueue(rows, state.countryCode);
    if (!state.queue.length) throw new Error('لم يتم العثور على ارقام صالحة داخل الملف');
    state.currentIndex = 0;
    save();
    render();
    showToast(`تم تجهيز ${state.queue.length} رسالة داخل الطابور`);
  } catch (error) {
    alert(error.message || 'تعذر قراءة الملف');
  }
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    alert('هذا المتصفح لا يدعم اشعارات النظام');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    state.notifications = true;
    save();
    notifyUser('تم تفعيل الاشعارات', 'سيظهر تنبيه عند تجهيز كل رسالة');
    render();
  } else {
    alert('لم يتم السماح بالاشعارات ويمكن تفعيلها لاحقا من اعدادات الموقع في المتصفح');
  }
}

async function processCurrent() {
  const current = state.queue[state.currentIndex];
  if (!current) return;

  if (current.status === 'opened') {
    current.status = 'sent';
    const next = state.queue.findIndex((item, index) => index > state.currentIndex && item.status !== 'sent');
    save();
    if (next === -1) {
      render();
      notifyUser('اكتملت الحملة', `تم اعتماد ارسال ${queueStats(state.queue).sent} رسالة`);
      showToast('اكتملت جميع رسائل الطابور');
      return;
    }
    state.currentIndex = next;
    save();
    render();
    setTimeout(openCurrentChat, 250);
    return;
  }

  openCurrentChat();
}

async function openCurrentChat() {
  const current = state.queue[state.currentIndex];
  if (!current) return;
  const text = fillTemplate(state.message, current.data);
  if (!text.trim()) {
    alert('اكتب نص الرسالة قبل بدء الحملة');
    return;
  }
  if (!isGoogleChrome()) {
    alert('يجب استخدام Google Chrome لتشغيل النظام وتجهيز الصور');
    return;
  }

  const extension = await extensionPing();
  if (!extension.installed) {
    alert('ثبت إضافة Google Chrome وفعلها ثم اضغط فحص الإضافة');
    return;
  }

  try {
    const imageDataUrl = await fileToDataUrl(state.imageFile);
    await extensionPrepare({
      phone: current.phone,
      message: text,
      imageDataUrl,
      fileName: state.imageName || 'campaign-image.png'
    });
  } catch (error) {
    alert(error.message || 'تعذر تجهيز الرسالة');
    return;
  }

  current.status = 'opened';
  save();
  const name = current.data['الاسم'] ?? current.data.name ?? current.phone;
  notifyUser('رسالة جاهزة للارسال', `تم تجهيز رسالة ${name}`);
  showToast(`تم تجهيز الرسالة رقم ${state.currentIndex + 1} من ${state.queue.length}`);
  render();
}

function notifyUser(title, body) {
  if (state.sound) playBeep();
  if (!state.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag: 'whatsapp-sender', renotify: true });
  } catch {
    // Some mobile browsers limit direct Notification construction.
  }
}

function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 720;
    gain.gain.value = 0.06;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
  } catch {
    // Audio may remain blocked until the user interacts with the page.
  }
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

window.addEventListener('error', (event) => {
  console.error(event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason);
});

try {
  render();
} catch (error) {
  console.error(error);
  app.innerHTML = `<main class="login-shell"><section class="login-card">
    <div class="brand large"><span>WhatsApp Sender</span><b></b></div>
    <h1>تعذر تحميل النظام</h1>
    <p>حدث خطأ اثناء تشغيل الصفحة حدث الصفحة او تواصل مع الدعم</p>
    <button onclick="location.reload()">اعادة المحاولة</button>
  </section></main>`;
}
