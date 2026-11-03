#!/usr/bin/env python3
"""Installs the APK on a running Android emulator and goes through the app like a new learner.

Onboarding → a 1-minute block → 今天 → 我的 (build id, backup share sheet) → dark mode → restart →
reinstall over itself, as an update does (the progress has to survive). Saves a screenshot per step
and the device log into OUT_DIR, and fails when a step doesn't appear or the app crashes.
Run by .github/workflows/android.yml.

Usage: python3 scripts/android-smoke.py APK OUT_DIR
"""

import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = 'com.sukimanihongo.app'
APK, OUT = sys.argv[1], Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
# The commit the APK was built from, which 我的 should show.
BUILD = (os.environ.get('APP_BUILD') or os.environ.get('GITHUB_SHA', ''))[:7]
shots = 0
last_dump = ''


def adb(*args: str, check: bool = True) -> str:
    result = subprocess.run(['adb', *args], capture_output=True, check=check)
    return result.stdout.decode('utf-8', 'replace')


def shot(name: str) -> None:
    global shots
    shots += 1
    png = subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True).stdout
    (OUT / f'{shots:02d}-{name}.png').write_bytes(png)
    print(f'screenshot {shots:02d}-{name}')


def save_log() -> str:
    log = adb('logcat', '-d', check=False)
    (OUT / 'logcat.txt').write_text(log, encoding='utf-8')
    return log


def fail(message: str) -> None:
    shot('failure')
    (OUT / 'ui.xml').write_text(last_dump, encoding='utf-8')
    log = save_log()
    crash = log.find('FATAL EXCEPTION')
    if crash >= 0:
        print(log[crash:crash + 4000])
    print(f'::error::{message}')
    sys.exit(1)


def alive() -> None:
    if not adb('shell', 'pidof', PACKAGE, check=False).strip():
        fail('The app is not running any more (crashed?)')


def labels() -> list[tuple[str, int, int]]:
    """Texts and descriptions on screen, each with the centre of its element."""
    global last_dump
    for _ in range(5):
        result = adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml', check=False)
        if 'dumped to' not in result:
            print(f'uiautomator: {result.strip()}')
            time.sleep(1)
            continue
        xml = adb('shell', 'cat', '/sdcard/ui.xml', check=False)
        try:
            root = ET.fromstring(xml)
            last_dump = xml
            break
        except ET.ParseError:
            time.sleep(1)
    else:
        return []
    found = []
    for node in root.iter('node'):
        box = [int(n) for n in re.findall(r'\d+', node.get('bounds', ''))]
        for label in (node.get('text'), node.get('content-desc')):
            if label and len(box) == 4:
                found.append((label, (box[0] + box[2]) // 2, (box[1] + box[3]) // 2))
    return found


def dismiss_dialogs(on_screen: list[tuple[str, int, int]]) -> bool:
    """Answers Android's 「… isn't responding」 dialog with Wait (the emulator's launcher is slow at first)."""
    if not any("isn't responding" in text for text, _, _ in on_screen):
        return False
    for text, x, y in on_screen:
        if text == 'Wait':
            print('Android asked about an app that is not responding: Wait')
            adb('shell', 'input', 'tap', str(x), str(y))
            time.sleep(2)
            return True
    return False


def screen() -> list[tuple[str, int, int]]:
    """labels(), after answering any system dialog in the way."""
    on_screen = labels()
    while dismiss_dialogs(on_screen):
        on_screen = labels()
    return on_screen


def find(label: str) -> tuple[int, int] | None:
    """Where `label` is on screen: an element with exactly that text, else one containing it."""
    on_screen = screen()
    for match in (lambda text: text == label, lambda text: label in text):
        for text, x, y in on_screen:
            if match(text):
                return x, y
    return None


def wait_for(label: str, timeout: float = 30) -> tuple[int, int]:
    end = time.time() + timeout
    while time.time() < end:
        alive()
        spot = find(label)
        if spot:
            return spot
        time.sleep(1)
    fail(f'「{label}」 did not appear')
    raise AssertionError


def tap(label: str, timeout: float = 30) -> None:
    x, y = wait_for(label, timeout)
    adb('shell', 'input', 'tap', str(x), str(y))
    time.sleep(1.5)


def scroll_down() -> None:
    width, height = map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size'))[-1])
    x = str(width // 2)
    adb('shell', 'input', 'swipe', x, str(height * 3 // 4), x, str(height // 3), '400')
    time.sleep(1)


def scroll_to(label: str) -> tuple[int, int]:
    """Scrolls down until `label` is on screen (the dump leaves out what is scrolled away)."""
    for _ in range(12):
        alive()
        spot = find(label)
        if spot:
            return spot
        scroll_down()
    fail(f'「{label}」 is not on the screen even after scrolling')
    raise AssertionError


def launch() -> None:
    adb('shell', 'am', 'start', '-W', '-n', f'{PACKAGE}/.MainActivity')


adb('install', '-r', APK)
adb('logcat', '-c')
# Let the freshly booted emulator settle on its home screen first.
adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
time.sleep(20)
launch()

# Onboarding: from zero, the default sound mode, 1-minute blocks.
wait_for('零碎時間，一點一點學日語', timeout=120)
shot('onboarding')
tap('開始')
wait_for('你的日語程度？')
shot('level')
tap('下一步')
wait_for('你通常怎麼學？')
tap('1 分鐘')
shot('mode')
tap('開始學習')

wait_for('連續天數')
shot('today')
tap('開始學習')

# A whole block: learn the new kana, give up on each question to see its answer, go on.
seen_question = False
for _ in range(60):
    alive()
    on_screen = {text for text, _, _ in screen()}
    if '回首頁' in on_screen:
        break
    if '不知道，看答案' in on_screen and not seen_question:
        seen_question = True
        shot('question')
    for action in ('記住了', '繼續', '不知道，看答案'):
        if action in on_screen:
            tap(action)
            break
    else:
        time.sleep(1)
else:
    fail('The block did not finish')
shot('block-done')
tap('回首頁')
wait_for('連續天數')
shot('today-after-block')

# 我的: backing up opens the share sheet. Android can't tell the app whether the backup was kept, so
# coming back asks; answering 還沒 records nothing. The footer shows this build's id.
tap('我的')
wait_for('每日目標')
shot('me')
x, y = scroll_to('備份學習紀錄')
adb('shell', 'input', 'tap', str(x), str(y))
time.sleep(3)
shot('backup-share-sheet')
adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
wait_for('備份存好了嗎？')
shot('backup-asked')
tap('還沒')
wait_for('還沒備份過')
scroll_to(f'Android 版 {BUILD}'.strip())
scroll_down()
shot('me-footer')

# Dark mode follows the phone.
tap('今天')
adb('shell', 'cmd', 'uimode', 'night', 'yes')
time.sleep(3)
wait_for('連續天數')
shot('today-dark')
adb('shell', 'cmd', 'uimode', 'night', 'no')

# Closing the app and installing the APK again (as an update does) keep the progress:
# 今天 opens directly, with today's block counted.
for step in ('restart', 'reinstall'):
    adb('shell', 'am', 'force-stop', PACKAGE)
    if step == 'reinstall':
        adb('install', '-r', APK)
    launch()
    wait_for('連續天數', timeout=60)
    if not any(re.fullmatch(r'1/\d+', text) for text, _, _ in screen()):
        fail(f'After the {step}, 今天 does not count the block done before')
    shot(f'today-after-{step}')

log = save_log()
for line in log.splitlines():
    if ' E ReactNativeJS' in line or 'E/ReactNativeJS' in line:
        print(f'::warning::{line}')
if 'FATAL EXCEPTION' in log:
    fail('The log has a crash')
print(f'All steps passed; {shots} screenshots in {OUT}')
