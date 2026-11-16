/*
 * waddlepaste.exe — WaddleSnap's Super Paste helper.
 * Presses Ctrl+V <count> times (optionally Enter/Tab/Space between pastes).
 *
 * usage: waddlepaste.exe <count> <delayMs> <none|enter|tab|space> [hotkeyVk]
 *        waddlepaste.exe --monitors   (prints true monitor pixel rects)
 * exit:  0 ok, 1 bad args, 2 input blocked (target app runs as administrator)
 *
 * Build: x86_64-w64-mingw32-gcc -O2 -s -mwindows -static -o waddlepaste.exe waddlepaste.c
 */
#include <windows.h>
#include <stdlib.h>
#include <string.h>

static const WORD MODS[] = { VK_LCONTROL, VK_RCONTROL, VK_LMENU, VK_RMENU, VK_LSHIFT, VK_RSHIFT, VK_LWIN, VK_RWIN };
#define NMODS (sizeof(MODS) / sizeof(MODS[0]))

static int is_extended(WORD vk) {
  return vk == VK_RCONTROL || vk == VK_RMENU || vk == VK_LWIN || vk == VK_RWIN;
}

static void make_key(INPUT *in, WORD vk, int up) {
  ZeroMemory(in, sizeof(*in));
  in->type = INPUT_KEYBOARD;
  in->ki.wVk = vk;
  in->ki.wScan = (WORD)(MapVirtualKeyW(vk, MAPVK_VK_TO_VSC) & 0xff);
  in->ki.dwFlags = (up ? KEYEVENTF_KEYUP : 0) | (is_extended(vk) ? KEYEVENTF_EXTENDEDKEY : 0);
}

static int down(WORD vk) { return (GetAsyncKeyState(vk) & 0x8000) != 0; }

/* Wait for the user to let go of the hotkey so Alt/Shift don't leak into the paste. */
static void wait_for_release(WORD hotkey_vk) {
  DWORD t0 = GetTickCount();
  while (GetTickCount() - t0 < 1500) {
    int held = hotkey_vk && down(hotkey_vk);
    for (unsigned i = 0; i < NMODS && !held; i++) held = down(MODS[i]);
    if (!held) return;
    Sleep(10);
  }
  /* Still held after 1.5 s: release modifiers in software. */
  INPUT ups[NMODS];
  UINT n = 0;
  for (unsigned i = 0; i < NMODS; i++) if (down(MODS[i])) make_key(&ups[n++], MODS[i], 1);
  if (n) SendInput(n, ups, sizeof(INPUT));
}

/* --monitors: print each monitor's true pixel rectangle ("left top right bottom"), one per line.
   Electron only knows rounded DIP sizes, which can be a pixel or two off at 125/175 % scaling. */
static BOOL CALLBACK print_monitor(HMONITOR m, HDC dc, LPRECT r, LPARAM lp) {
  (void)dc; (void)r; (void)lp;
  MONITORINFOEXW mi; ZeroMemory(&mi, sizeof mi); mi.cbSize = sizeof mi;
  if (!GetMonitorInfoW(m, (MONITORINFO *)&mi)) return TRUE;
  DEVMODEW dm; ZeroMemory(&dm, sizeof dm); dm.dmSize = sizeof dm;
  long w = mi.rcMonitor.right - mi.rcMonitor.left, h = mi.rcMonitor.bottom - mi.rcMonitor.top;
  if (EnumDisplaySettingsW(mi.szDevice, ENUM_CURRENT_SETTINGS, &dm)) { w = (long)dm.dmPelsWidth; h = (long)dm.dmPelsHeight; }
  char line[128];
  int n = wsprintfA(line, "%ld %ld %ld %ld\r\n", mi.rcMonitor.left, mi.rcMonitor.top, mi.rcMonitor.left + w, mi.rcMonitor.top + h);
  DWORD wr; WriteFile(GetStdHandle(STD_OUTPUT_HANDLE), line, n, &wr, NULL);
  return TRUE;
}

static void make_per_monitor_aware(void) {
  typedef BOOL (WINAPI *SetCtx)(HANDLE);
  SetCtx f = (SetCtx)GetProcAddress(GetModuleHandleW(L"user32.dll"), "SetProcessDpiAwarenessContext");
  if (!f || !f((HANDLE)-4 /* PER_MONITOR_AWARE_V2 */)) SetProcessDPIAware();
}

int WINAPI WinMain(HINSTANCE h, HINSTANCE p, LPSTR cmd, int show) {
  (void)h; (void)p; (void)cmd; (void)show;
  make_per_monitor_aware();
  if (__argc >= 2 && !strcmp(__argv[1], "--monitors")) {
    EnumDisplayMonitors(NULL, NULL, print_monitor, 0);
    return 0;
  }
  if (__argc < 4) return 1;
  int count = atoi(__argv[1]);
  int delay = atoi(__argv[2]);
  const char *sep = __argv[3];
  WORD hotkey_vk = __argc > 4 ? (WORD)atoi(__argv[4]) : 0;
  if (count < 1 || count > 100) return 1;
  if (delay < 10) delay = 10;
  if (delay > 2000) delay = 2000;

  WORD sep_vk = 0;
  if (!strcmp(sep, "enter")) sep_vk = VK_RETURN;
  else if (!strcmp(sep, "tab")) sep_vk = VK_TAB;
  else if (!strcmp(sep, "space")) sep_vk = VK_SPACE;

  wait_for_release(hotkey_vk);
  Sleep(25);

  for (int i = 0; i < count; i++) {
    INPUT ev[4];
    make_key(&ev[0], VK_LCONTROL, 0);
    make_key(&ev[1], 'V', 0);
    make_key(&ev[2], 'V', 1);
    make_key(&ev[3], VK_LCONTROL, 1);
    if (SendInput(4, ev, sizeof(INPUT)) != 4) return 2;
    if (i < count - 1) {
      if (sep_vk) {
        Sleep(delay < 40 ? delay : 40);
        INPUT s[2];
        make_key(&s[0], sep_vk, 0);
        make_key(&s[1], sep_vk, 1);
        SendInput(2, s, sizeof(INPUT));
      }
      Sleep(delay);
    }
  }
  return 0;
}
