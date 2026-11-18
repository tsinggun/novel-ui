using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;

namespace NovelBuilderLauncher
{
    /// <summary>
    /// 小说构建器 · 单文件启动器
    ///
    /// 这个 exe 里塞了三样东西（一个 zip 资源）：
    ///   1. node/node.exe          —— 便携版 Node（本机不需要装 Node）
    ///   2. client/server.mjs      —— 本地服务 + 数据文件读写
    ///   3. dist/                  —— 前端构建产物
    ///
    /// 启动流程：
    ///   首次运行 → 把 zip 解到 %LOCALAPPDATA%\NovelUI\app\&lt;版本&gt;\
    ///   → 用隐藏窗口跑 node client/server.mjs（它会自己开一个无地址栏窗口）
    ///   → 本进程留在后台等 node 退出，一起结束
    ///
    /// 为什么要解到本地而不是直接跑内存：node 需要一个真实的工作目录来读 dist/ 和写日志。
    /// </summary>
    internal static class Program
    {
        private const string AppVersion = "0.2.10";
        private const string PayloadResource = "payload.zip";

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);

        /// <summary>启动器日志：双击看不到控制台，出问题只能靠这个文件排查</summary>
        private static void Log(string message)
        {
            try
            {
                string dir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Documents", "NovelUI");
                Directory.CreateDirectory(dir);
                string line = "[" + DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "] " + message + Environment.NewLine;
                using (FileStream fs = new FileStream(Path.Combine(dir, "launcher.log"), FileMode.Append, FileAccess.Write, FileShare.Read))
                {
                    byte[] bytes = Encoding.UTF8.GetBytes(line);
                    fs.Write(bytes, 0, bytes.Length);
                }
            }
            catch { /* 日志写不了就算了 */ }
        }

        private static void Fail(string message)
        {
            Log("启动失败：" + message.Replace("\n", " "));
            MessageBoxW(IntPtr.Zero, message, "小说构建器 · 启动失败", 0x10);
            Environment.Exit(1);
        }

        private static string AppDir()
        {
            string baseDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "NovelUI",
                "app");
            return Path.Combine(baseDir, AppVersion);
        }

        /// <summary>把内置 zip 解开；已经解过就跳过（按版本号做目录，升级换版本自然重解）</summary>
        private static void EnsurePayload(string appDir)
        {
            string nodePath = Path.Combine(appDir, "node", "node.exe");
            string serverPath = Path.Combine(appDir, "client", "server.mjs");
            string indexPath = Path.Combine(appDir, "dist", "index.html");

            if (File.Exists(nodePath) && File.Exists(serverPath) && File.Exists(indexPath))
            {
                Log("运行文件已就位，跳过解压");
                return;
            }

            Log("首次运行，开始解压内置运行文件 → " + appDir);
            Directory.CreateDirectory(appDir);

            Assembly asm = Assembly.GetExecutingAssembly();
            Stream payload = null;
            foreach (string name in asm.GetManifestResourceNames())
            {
                Log("发现资源：" + name);
                if (name.EndsWith("payload.zip", StringComparison.OrdinalIgnoreCase))
                {
                    payload = asm.GetManifestResourceStream(name);
                    break;
                }
            }
            if (payload == null)
            {
                Fail("这个 exe 里没有内置运行文件（payload.zip 缺失），打包过程出了问题。");
                return;
            }

            using (payload)
            {
                // 先解到临时目录再整体搬过去，避免解压一半被中断留下坏目录
                string tempDir = appDir + ".tmp-" + Guid.NewGuid().ToString("n").Substring(0, 8);
                Directory.CreateDirectory(tempDir);
                using (ZipArchive zip = new ZipArchive(payload, ZipArchiveMode.Read))
                {
                    Log("压缩包内共 " + zip.Entries.Count + " 项");
                    zip.ExtractToDirectory(tempDir);
                }
                Log("解压完成 → " + tempDir);

                // 目标目录里可能残留半份旧文件：清掉再搬
                if (Directory.Exists(appDir))
                {
                    try { Directory.Delete(appDir, true); }
                    catch { /* 删不掉就让下面搬文件时报错 */ }
                }
                Directory.CreateDirectory(Path.GetDirectoryName(appDir));
                Directory.Move(tempDir, appDir);
                Log("已搬到：" + appDir);
            }
        }

        private static void Main(string[] args)
        {
            try
            {
                Log("启动器开始运行，版本 " + AppVersion);
                string appDir = AppDir();
                EnsurePayload(appDir);

                string nodeExe = Path.Combine(appDir, "node", "node.exe");
                string serverMjs = Path.Combine(appDir, "client", "server.mjs");

                if (!File.Exists(nodeExe)) Fail("没有找到内置的 Node 运行环境：\n" + nodeExe);
                if (!File.Exists(serverMjs)) Fail("没有找到服务端脚本：\n" + serverMjs);

                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = "\"" + serverMjs + "\"",
                    WorkingDirectory = appDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                // 传递额外参数（比如 NOVEL_FILE 之类由调用方指定时）
                foreach (string arg in args)
                {
                    startInfo.Arguments += " " + arg;
                }

                Process server = Process.Start(startInfo);
                if (server == null) Fail("Node 进程没有启动起来。");
                Log("Node 已启动，PID " + server.Id + "，等待它打开窗口…");

                // 本进程留在后台：浏览器窗口关掉、node 退出时一起结束，避免残留孤儿进程
                server.WaitForExit();
                Log("Node 已退出，退出码 " + server.ExitCode);
                Environment.Exit(server.ExitCode);
            }
            catch (Exception ex)
            {
                Fail("启动时出错：\n\n" + ex.Message);
            }
        }
    }
}
