#!/bin/sh
# รวม adapter + engine เป็นไฟล์เดียวสำหรับวางใน Apps Script
cd "$(dirname "$0")"
{ cat gas/adapter.gs; echo; echo '// ================================================================ ENGINE (สำเนาจาก web/assets/js/engine.js — ห้ามแก้ตรงนี้)'; grep -v "^if (typeof module" web/assets/js/engine.js; } > gas/Code.gs
