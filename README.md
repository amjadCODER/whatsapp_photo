# WhatsApp Sender Cloud v1.5

## المكونات

- واجهة سحابية جاهزة للنشر على Vercel
- إضافة Google Chrome داخل مجلد extension
- ملف إضافة مضغوط قابل للتحميل من النظام
- نموذج Excel قابل للتحميل
- تجهيز النص والصورة داخل WhatsApp Web
- الضغط النهائي على إرسال يبقى بيد المستخدم

## إعداد Vercel

- Framework Preset: Other
- Root Directory: ./
- Build Command: npm run build
- Output Directory: dist
- Install Command: npm install

## تثبيت الإضافة

1. حمل الإضافة من داخل النظام
2. فك ضغط الملف
3. افتح chrome://extensions في Google Chrome
4. فعل وضع المطور
5. اختر تحميل إضافة غير مضغوطة
6. اختر مجلد الإضافة
7. ارجع إلى النظام واضغط فحص الإضافة

## ملاحظة

صلاحية الإضافة محددة حاليا لنطاق النشر:
web-whatsapp-alpha.vercel.app

عند تغيير النطاق يجب تحديث host_permissions و matches داخل extension/manifest.json.
