﻿using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using System.Net.Http;
using System.Reflection;

using Yepi;

namespace DatabaseWorkbench
{
    public partial class Form1 : Form
    {
        WebBrowser _webBrowser;
        Process _backendProcess;
        //string _websiteURL = "http://localhost:5555";
        string _websiteURL = "http://databaseworkbench.com";
        bool _cleanFinish = false;
        string _updateInstallerPath;

        private void InitializeComponent2()
        {
            Layout += Form1_Layout;
            Load += Form1_Load;
            FormClosing += Form1_FormClosing;
            SuspendLayout();
            _webBrowser = new WebBrowser()
            {
                AllowNavigation = true,
                IsWebBrowserContextMenuEnabled = false,
            };
            Controls.Add(_webBrowser);
            ResumeLayout(true);
        }

        private void Form1_FormClosing(object sender, FormClosingEventArgs e)
        {
            // TODO: weird. It looks like _backendProcess gets killed after we set _cleanFinish
            // but before Log.Line().
            _cleanFinish = true;
            if (_backendProcess != null)
            {
                Log.Line($"Form1_FormClosing: backend exited: {_backendProcess.HasExited}");
            }
            // TODO: if we have multiple forms, only when last form is being closed
            if (_backendProcess != null && !_backendProcess.HasExited)
            {
                Log.Line($"Form1_FormClosing: killing backend");
                _backendProcess.Kill();
            }
            Log.Close();
        }

        // Find directory where dbherohelper.exe is
        // Returns "" if not found
        private string FindBackendDirectory()
        {
            var path = Application.ExecutablePath;
            var dir = Path.GetDirectoryName(path);
            while (dir != null)
            {
                path = Path.Combine(dir, "dbherohelper.exe");
                if (File.Exists(path))
                {
                    return dir;
                }
                var newDir = Path.GetDirectoryName(dir);
                if (dir == newDir)
                {
                    return "";
                }
                dir = newDir;
            }
            return "";
        }

        private bool StartBackendServer()
        {
            var dir = FindBackendDirectory();
            if (dir == "")
            {
                Log.S("StartBackendServer: FindBackendDirectory() failed\n");
                return false;
            }
            // explanation of StartInfo flags:
            // http://blogs.msdn.com/b/jmstall/archive/2006/09/28/createnowindow.aspx
            var p = new Process();
            _backendProcess = p;
            p.StartInfo.WorkingDirectory = dir;
            p.StartInfo.FileName = "dbherohelper.exe";
            p.StartInfo.UseShellExecute = true;
            p.StartInfo.CreateNoWindow = true;
            p.StartInfo.WindowStyle = ProcessWindowStyle.Hidden;
            p.Exited += Backend_Exited;
            var ok = p.Start();
            return ok;
        }

        // happens when go backend process has finished e.g. because of an error
        private void Backend_Exited(object sender, EventArgs e)
        {
            Log.Line($"Backend_Exited. _clienFinish:{_cleanFinish}");
            if (_cleanFinish)
            {
                // we killed the process ourselves
                return;
            }
            // TODO: show better error message
            MessageBox.Show("backend exited unexpectedly!");
            Close();
        }


        // Note: can't be in utils, must be in this assembly
        public static string AppVer()
        {
            Assembly assembly = Assembly.GetExecutingAssembly();
            FileVersionInfo fvi = FileVersionInfo.GetVersionInfo(assembly.Location);
            return Utils.CleanAppVer(fvi.ProductVersion);
        }

        // must happen before StartBackendServer()
        string _backendUsage = "";
        public void LoadUsage()
        {
            // can happen because UsageFilePath() might not exist on first run
            // TODO: make it File.TryReadAllText()
            try
            {
                _backendUsage = File.ReadAllText(Util.UsageFilePath());
            }
            catch (Exception e)
            {
                Log.E(e);
            }
            // delete so that we don't the same data multiple times
            FileUtil.TryFileDelete(Util.UsageFilePath());
        }

        /* the data we POST as part of auto-update check is in format:
        ver: ${ver}
        os: 6.1
        other: ${other_val}
        -----------
        ${usage data from backend}
        */
        private string BuildAutoUpdatePostData()
        {
            var computerInfo = Util.GetComputerInfo();

            var s = "";
            s += $"ver: {AppVer()}\n";
            s += "ostype: windows\n";
            s += $"user: {computerInfo.UserName}\n";
            s += $"os: {computerInfo.OsVersion}\n";
            if (computerInfo.NetworkCardId != "")
            {
                s += $"networkCardId: {computerInfo.NetworkCardId}\n";
            }
            s += $"machine: {computerInfo.MachineName}\n";
            s += $"net: {computerInfo.InstalledNetVersions}\n";

            s += "---------------\n"; // separator
            if (_backendUsage != "")
            {
                s += _backendUsage + "\n";
            }
            return s;
        }

        private async Task AutoUpdateCheck()
        {
            // we might have downloaded installer previously, in which case
            // don't re-download
            var tmpInstallerPath = Util.UpdateInstallerTmpPath();
            if (File.Exists(tmpInstallerPath))
            {
                _updateInstallerPath = tmpInstallerPath;
                NotifyUpdateAvailable();
                return;
            }

            var myVer = AppVer();
            var postData = BuildAutoUpdatePostData();
            Log.Line(postData);

            var url = _websiteURL + "/api/winupdatecheck?ver=" + myVer;
            var result = await Http.PostStringAsync(url, postData);
            if (result == null)
            {
                Log.Line("AutoUpdateCheck(): result is null");
                return;
            }

            //Console.WriteLine($"result: {result}");
            string ver, dlUrl;
            var ok = Utils.ParseUpdateResponse(result, out ver, out dlUrl);
            if (!ok)
            {
                Log.Line($"AutoUpdateCheck: failed to parse ver '{ver}'");
                return;
            }

            if (!Utils.ProgramVersionGreater(ver, myVer))
            {
                Log.Line($"AutoUpdateCheck: not updating because my version{myVer}  is >= than lateset available {ver}");
                return;
            }
            var d = await Http.UrlDownloadAsync(dlUrl);
            if (d == null)
            {
                Log.Line($"AutoUpdateCheck: failed to download {dlUrl}");
                return;
            }
            _updateInstallerPath = Util.UpdateInstallerTmpPath();
            try
            {
                File.WriteAllBytes(_updateInstallerPath, d);
            }
            catch
            {
                File.Delete(_updateInstallerPath);
                _updateInstallerPath = null;
                return;
            }
            NotifyUpdateAvailable();
        }

        public void NotifyUpdateAvailable()
        {
            // TODO: show a nicer dialog
            var res = MessageBox.Show("Update available. Update?", "Update available", MessageBoxButtons.YesNo);
            if (res != DialogResult.Yes)
            {
                return;
            }
            Console.WriteLine($"should run an updater {_updateInstallerPath}");
            // move the installer to another, temporary path, so that when the installation is finished
            // and we restart the app, we won't think an update is available
            var tmpInstallerPath = Path.GetTempFileName();
            File.Delete(tmpInstallerPath);
            tmpInstallerPath += ".exe";
            File.Move(_updateInstallerPath, tmpInstallerPath);
            _updateInstallerPath = null;
            FileUtil.TryLaunchUrl(tmpInstallerPath);
            // exit ourselves so that the installer can over-write the file
            Close();
        }

        private async void Form1_Load(object sender, EventArgs e)
        {
            LoadUsage();
            if (!StartBackendServer())
            {
                // TODO: better way to show error message
                MessageBox.Show("Backend didn't start. Quitting.");
                Close();
                return;
            }
            _webBrowser.Navigate("http://127.0.0.1:5444");
            await AutoUpdateCheck();
        }

        private void Form1_Layout(object sender, LayoutEventArgs e)
        {
            var area = ClientSize;
            _webBrowser.SetBounds(0, 0, area.Width, area.Height);
        }

        public Form1()
        {
            InitializeComponent();
            InitializeComponent2();
        }
    }
}
