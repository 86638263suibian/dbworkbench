import Cocoa
import AppKit

var serverTask = NSTask()
var waitsForMoreServerOutput = true

// TODO: move to log.swift
var shouldOpenLog = true
var logLock = NSLock()
var logFile : NSOutputStream?

func openLogFileIfNeeded() {
    if logFile != nil {
        return
    }
    if !shouldOpenLog {
        return
    }

    let dir =  NSString.pathWithComponents([getDataDir(), "log"])
    
    let dateFmt = NSDateFormatter()
    dateFmt.dateFormat = "'log-'yy-MM-dd'-mac.txt"
    let logName = dateFmt.stringFromDate(NSDate())
    if (!NSFileManager.defaultManager().fileExistsAtPath(dir)) {
        do {
            try NSFileManager.defaultManager().createDirectoryAtPath(dir, withIntermediateDirectories: true, attributes: nil)
        } catch _ {
            // failed
            shouldOpenLog = false
            return
        }
        
    }
    
    let logPath = NSString.pathWithComponents([dir, logName])
    logFile = NSOutputStream(toFileAtPath: logPath, append: true)
    logFile?.open()
}

func closeLogFile() {
    logLock.lock()
    logFile?.close()
    logFile = nil
    logLock.unlock()
}

func log(s : String) {
    logLock.lock()
    openLogFileIfNeeded()
    print(s)
    if let lf = logFile {
        // TODO: only if doesn't end with '\n' already
        let s2 = s + "\n"
        let encodedDataArray = [UInt8](s2.utf8)
        let n = lf.write(encodedDataArray, maxLength: encodedDataArray.count)
        if n == -1 && false {
            print("write failed with error: '\(logFile?.streamError)'")
        }
    }
    logLock.unlock()
}

// TODO: use NSTak termination handler to get notified the backend process
// exists and show some error (or try to restart automatically)

// TODO: this doesn't work because NSWorkspace.runningApplications doesn't
// include backend process
// I found https://github.com/beltex/SystemKit/blob/master/SystemKit/Process.swift but
// it requires being root
// http://stackoverflow.com/questions/2518160/programmatically-check-if-a-process-is-running-on-mac
// is a C implementation
// terminate backend if it's running. This can happen e.g. when app crashes
// and doesn't terminate backend properly
func killBackendIfRunning(backendPath : String) {
    let wsk = NSWorkspace.sharedWorkspace()
    let processes = wsk.runningApplications
    for proc in processes {
        if let appUrl = proc.executableURL {
            if let path = appUrl.path {
                log("path: \(path)")
                if path == backendPath {
                    let pid = proc.processIdentifier
                    log("killing process \(pid) '\(path)' because bacckend shouldn't be running")
                    proc.forceTerminate()
                    // wait up to 10 secs for process to terminate
                    var i = 10
                    while i > 0 {
                        if proc.terminated {
                            return
                        }
                        sleep(1)
                        i -= 1
                    }
                }
            }
        }
    }
}

func getDataDir() -> String {
    return NSString.pathWithComponents([NSHomeDirectory(), "Library", "Application Support", "Database Workbench"])
}

var backendUsage = ""

// must be executed before starting backend in order to read usage.json
func loadUsageData() {
    let path = NSString.pathWithComponents([getDataDir(), "usage.json"])
    do {
        let s = try NSString(contentsOfFile: path, encoding: NSUTF8StringEncoding)
        backendUsage = s as String;
        // delete so that we don't send duplicate data
        try NSFileManager.defaultManager().removeItemAtPath(path)
    }
    catch let error as NSError {
        log("loadUsageData: error: \(error)")
    }
}

func runServer(view : ViewController) {
    // TODO: this should not be necessary but without it serverTask is nil
    serverTask = NSTask()
    let resPath = NSBundle.mainBundle().resourcePath
    let serverGoExePath = resPath! + "/dbworkbench.exe"
    
    //killBackendIfRunning(serverGoExePath)

    serverTask.launchPath = serverGoExePath
    serverTask.currentDirectoryPath = resPath!
    //        serverTask.arguments = ["-dev"]
    
    let pipe = NSPipe()
    serverTask.standardOutput = pipe
    serverTask.standardError = pipe
    
    let outHandle = pipe.fileHandleForReading
    outHandle.waitForDataInBackgroundAndNotify()
    
    let _ = NSNotificationCenter.defaultCenter().addObserverForName(NSFileHandleDataAvailableNotification, object: outHandle, queue: nil, usingBlock: { notification -> Void in
        
        if !waitsForMoreServerOutput {
            return
        }

        let output = outHandle.availableData
        let outStr = NSString(data: output, encoding: NSUTF8StringEncoding)
        // wait until backend prints "Started running on..."
        if outStr?.length > 0 {
            let s = outStr! as String
            // TODO: this is not entirely fool-proof as we might get "Started running"
            // line before we get "failed with" line
            if (s.containsString("failed with")) {
                // TODO: notify about the error in the UI
                // this could be "http.ListendAndServer() failed with listen tcp 127.0.0.1:5444: bind: address already in use"
                log("runServer: failed because output is: '\(s)'")
                waitsForMoreServerOutput = false
                return
            }
            if (s.containsString("Started running on")) {
                log("runServer: ")
                waitsForMoreServerOutput = false
                view.loadURL()
                return
            }
        }
        outHandle.waitForDataInBackgroundAndNotify()
    })

    serverTask.launch()
    let pid = serverTask.processIdentifier
    log("backend started, pid: \(pid)")
}

func closeServer() {
    log("closing backend")
    serverTask.terminate()
}

