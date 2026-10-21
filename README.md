# ভবানীপুর ডাটাবেজ

লাইট মোড, মাল্টি-পেজ frontend।

- `index.html` — হোম (খোঁজ, পরিসংখ্যান, সর্বশেষ যুক্ত)
- `people.html` — তথ্য তালিকা ও খোঁজ
- `add.html` — নতুন ব্যক্তি যোগ করার ফর্ম (প্রতি পেজের উপরে "+ নতুন ব্যক্তি" বাটন)

চালাতে: `python3 -m http.server 8080` তারপর `http://localhost:8080`।

গুরুত্বপূর্ণ: API key `app.js`-এ থাকায় সবাই দেখতে পারবে। Public deploy-এর আগে key rotate করে server-side proxy ব্যবহার করুন।
