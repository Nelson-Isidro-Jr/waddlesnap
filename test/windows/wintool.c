/*
 * wintool.exe — test helper for WaddleSnap's Windows end-to-end tests.
 *   wintool keys <vk> [vk...]       press keys down in order, release in reverse (real input)
 *   wintool click <x> <y>           real left click at physical screen coords
 *   wintool move <x> <y>            move the mouse
 *   wintool clickwin <pid> [class]  click the centre of a process's top-level window (or by class)
 *   wintool gettext <pid> [class]   print the text of the window's Edit/RichEdit control (UTF-8)
 *   wintool shot <out.bmp>          capture the whole virtual screen with GDI (independent of the app)
 *   wintool clipinfo                list clipboard formats and the CF_DIB size
 *   wintool clipdump <out.bmp>      save the clipboard CF_DIB as a .bmp
 * Build: x86_64-w64-mingw32-gcc -O2 -s -static -o wintool.exe wintool.c -lgdi32
 */
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <io.h>
#include <fcntl.h>

static void key(WORD vk, int up) {
  INPUT in; ZeroMemory(&in, sizeof in);
  in.type = INPUT_KEYBOARD; in.ki.wVk = vk;
  in.ki.wScan = (WORD)MapVirtualKeyW(vk, 0);
  in.ki.dwFlags = up ? KEYEVENTF_KEYUP : 0;
  if (vk == VK_RCONTROL || vk == VK_RMENU || vk == VK_LWIN || vk == VK_RWIN) in.ki.dwFlags |= KEYEVENTF_EXTENDEDKEY;
  SendInput(1, &in, sizeof in);
}

static void mouse(DWORD flags) {
  INPUT in; ZeroMemory(&in, sizeof in);
  in.type = INPUT_MOUSE; in.mi.dwFlags = flags;
  SendInput(1, &in, sizeof in);
}

static void click(int x, int y) {
  SetCursorPos(x, y); Sleep(60);
  mouse(MOUSEEVENTF_LEFTDOWN); Sleep(40); mouse(MOUSEEVENTF_LEFTUP);
}

typedef struct { DWORD pid; const char *cls; HWND found; } FindCtx;
static BOOL CALLBACK find_top(HWND h, LPARAM lp) {
  FindCtx *c = (FindCtx *)lp;
  DWORD pid = 0; GetWindowThreadProcessId(h, &pid);
  if (!IsWindowVisible(h)) return TRUE;
  char cls[128] = {0}; GetClassNameA(h, cls, sizeof cls);
  if ((c->pid && pid == c->pid) || (c->cls && !strcmp(cls, c->cls))) { c->found = h; return FALSE; }
  return TRUE;
}
static HWND top_window(DWORD pid, const char *cls) {
  FindCtx c = { pid, cls, NULL };
  EnumWindows(find_top, (LPARAM)&c);
  return c.found;
}
static BOOL CALLBACK find_edit(HWND h, LPARAM lp) {
  char cls[128] = {0}; GetClassNameA(h, cls, sizeof cls);
  if (!strcmp(cls, "Edit") || !strncmp(cls, "RichEdit", 8)) { *(HWND *)lp = h; return FALSE; }
  return TRUE;
}

static int write_bmp(const char *path, const BITMAPINFOHEADER *bih, const void *bits, DWORD bitsSize, DWORD paletteSize) {
  FILE *f = fopen(path, "wb"); if (!f) return 1;
  BITMAPFILEHEADER fh; ZeroMemory(&fh, sizeof fh);
  fh.bfType = 0x4D42;
  fh.bfOffBits = sizeof fh + bih->biSize + paletteSize;
  fh.bfSize = fh.bfOffBits + bitsSize;
  fwrite(&fh, sizeof fh, 1, f); fwrite(bih, bih->biSize + paletteSize, 1, f); fwrite(bits, bitsSize, 1, f);
  fclose(f); return 0;
}

static int shot(const char *path) {
  int x = GetSystemMetrics(SM_XVIRTUALSCREEN), y = GetSystemMetrics(SM_YVIRTUALSCREEN);
  int w = GetSystemMetrics(SM_CXVIRTUALSCREEN), h = GetSystemMetrics(SM_CYVIRTUALSCREEN);
  HDC screen = GetDC(NULL), mem = CreateCompatibleDC(screen);
  HBITMAP bmp = CreateCompatibleBitmap(screen, w, h);
  HGDIOBJ old = SelectObject(mem, bmp);
  BitBlt(mem, 0, 0, w, h, screen, x, y, SRCCOPY | CAPTUREBLT);
  SelectObject(mem, old);
  BITMAPINFOHEADER bih; ZeroMemory(&bih, sizeof bih);
  bih.biSize = sizeof bih; bih.biWidth = w; bih.biHeight = -h; bih.biPlanes = 1; bih.biBitCount = 32; bih.biCompression = BI_RGB;
  DWORD size = (DWORD)w * h * 4;
  void *bits = malloc(size);
  GetDIBits(mem, bmp, 0, h, bits, (BITMAPINFO *)&bih, DIB_RGB_COLORS);
  int r = write_bmp(path, &bih, bits, size, 0);
  printf("%dx%d at %d,%d\n", w, h, x, y);
  free(bits); DeleteObject(bmp); DeleteDC(mem); ReleaseDC(NULL, screen);
  return r;
}

static int open_clip(void) {
  for (int i = 0; i < 20; i++) { if (OpenClipboard(NULL)) return 1; Sleep(50); }
  return 0;
}

int main(int argc, char **argv) {
  SetProcessDPIAware();
  _setmode(_fileno(stdout), _O_BINARY); /* keep \r\n from the app untouched */
  if (argc < 2) return 1;
  const char *cmd = argv[1];
  if (!strcmp(cmd, "keys")) {
    for (int i = 2; i < argc; i++) { key((WORD)strtol(argv[i], NULL, 0), 0); Sleep(30); }
    Sleep(60);
    for (int i = argc - 1; i >= 2; i--) { key((WORD)strtol(argv[i], NULL, 0), 1); Sleep(20); }
    return 0;
  }
  if (!strcmp(cmd, "click") && argc >= 4) { click(atoi(argv[2]), atoi(argv[3])); return 0; }
  if (!strcmp(cmd, "move") && argc >= 4) { SetCursorPos(atoi(argv[2]), atoi(argv[3])); return 0; }
  if (!strcmp(cmd, "drag") && argc >= 6) {
    int x1 = atoi(argv[2]), y1 = atoi(argv[3]), x2 = atoi(argv[4]), y2 = atoi(argv[5]);
    SetCursorPos(x1, y1); Sleep(80); mouse(MOUSEEVENTF_LEFTDOWN); Sleep(80);
    for (int i = 1; i <= 12; i++) { SetCursorPos(x1 + (x2 - x1) * i / 12, y1 + (y2 - y1) * i / 12); mouse(MOUSEEVENTF_MOVE); Sleep(25); }
    Sleep(80); mouse(MOUSEEVENTF_LEFTUP);
    return 0;
  }
  if ((!strcmp(cmd, "clickwin") || !strcmp(cmd, "gettext")) && argc >= 3) {
    HWND h = top_window((DWORD)atoi(argv[2]), argc > 3 ? argv[3] : NULL);
    if (!h) { printf("NOWINDOW\n"); return 3; }
    if (!strcmp(cmd, "clickwin")) {
      ShowWindow(h, SW_RESTORE);
      RECT r; GetWindowRect(h, &r);
      click((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      printf("%ld,%ld,%ld,%ld\n", r.left, r.top, r.right, r.bottom);
      return 0;
    }
    HWND e = NULL; EnumChildWindows(h, find_edit, (LPARAM)&e);
    if (!e) { printf("NOEDIT\n"); return 4; }
    int n = (int)SendMessageW(e, WM_GETTEXTLENGTH, 0, 0);
    wchar_t *buf = calloc(n + 1, sizeof(wchar_t));
    SendMessageW(e, WM_GETTEXT, n + 1, (LPARAM)buf);
    int u = WideCharToMultiByte(CP_UTF8, 0, buf, -1, NULL, 0, NULL, NULL);
    char *out = malloc(u);
    WideCharToMultiByte(CP_UTF8, 0, buf, -1, out, u, NULL, NULL);
    fwrite(out, 1, strlen(out), stdout);
    return 0;
  }
  if (!strcmp(cmd, "shot") && argc >= 3) return shot(argv[2]);
  if (!strcmp(cmd, "clipinfo")) {
    if (!open_clip()) { printf("CANTOPEN\n"); return 5; }
    UINT f = 0; printf("formats:");
    while ((f = EnumClipboardFormats(f))) {
      char name[128] = {0};
      if (!GetClipboardFormatNameA(f, name, sizeof name)) snprintf(name, sizeof name, "#%u", f);
      printf(" %s", name);
    }
    printf("\n");
    HANDLE d = GetClipboardData(CF_DIB);
    if (d) { BITMAPINFOHEADER *b = GlobalLock(d); printf("dib: %ldx%ld bpp=%d\n", b->biWidth, labs(b->biHeight), b->biBitCount); GlobalUnlock(d); }
    else printf("dib: none\n");
    CloseClipboard();
    return 0;
  }
  if (!strcmp(cmd, "clipdump") && argc >= 3) {
    if (!open_clip()) return 5;
    HANDLE d = GetClipboardData(CF_DIB);
    if (!d) {
      UINT png = RegisterClipboardFormatA("PNG");
      HANDLE pd = GetClipboardData(png);
      if (!pd) { CloseClipboard(); printf("NODIB\n"); return 6; }
      char path[MAX_PATH]; snprintf(path, sizeof path, "%s.png", argv[2]);
      FILE *f = fopen(path, "wb"); void *p = GlobalLock(pd);
      fwrite(p, 1, GlobalSize(pd), f); fclose(f); GlobalUnlock(pd); CloseClipboard();
      printf("PNG-only %s\n", path); return 7;
    }
    BITMAPINFOHEADER *b = GlobalLock(d);
    DWORD total = (DWORD)GlobalSize(d);
    DWORD pal = (b->biCompression == BI_BITFIELDS && b->biSize == sizeof(BITMAPINFOHEADER)) ? 12 : 0;
    DWORD head = b->biSize + pal;
    int r = write_bmp(argv[2], b, (BYTE *)b + head, total - head, pal);
    printf("%ldx%ld bpp=%d compression=%lu\n", b->biWidth, labs(b->biHeight), b->biBitCount, b->biCompression);
    GlobalUnlock(d); CloseClipboard();
    return r;
  }
  return 1;
}
