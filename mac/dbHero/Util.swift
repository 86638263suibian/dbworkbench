import Foundation


extension Bundle {
    
    var shortVersion: String {
        if let ver = self.infoDictionary?["CFBundleShortVersionString"] as? String {
            return ver
        }
        return "unknown"
    }
    
    var version: String {
        if let ver = self.infoDictionary?["CFBundleVersion"] as? String {
            return ver
        }
        return "unknown"
    }
    
}

func parseAutoUpdateCheck(_ s : String) -> (ver: String?, url: String?) {
    var ver : String?
    var url : String?
    let parts = s.components(separatedBy: "\n")
    for p in parts {
        let parts = p.components(separatedBy: ": ")
        if parts.count != 2 {
            continue
        }
        let name = parts[0]
        let val = parts[1]
        if name == "ver" {
            ver = val
        } else if name == "url" {
            url = val
        }
    }
    return (ver, url)
}

func versionArrayElToInt(_ a : [String], pos : Int) -> Int {
    if pos >= a.count {
        return 0
    }
    
    let s = a[pos]
    if let n = Int(s) {
        return n
    }
    log("versionArrayElToInt: '\(s)' is not a valid number")
    return 0
}

// return true if ver1 > ver2
// version is in the format "0.1.3", "1.2" etc.
func programVersionGreater(_ ver1 : String, ver2 : String) -> Bool {
    let parts1 = ver1.components(separatedBy: ".")
    let parts2 = ver2.components(separatedBy: ".")
    var n = parts1.count
    if parts2.count > n {
        n = parts2.count
    }
    for i in 0 ..< n {
        let n1 = versionArrayElToInt(parts1, pos: i)
        let n2 = versionArrayElToInt(parts2, pos: i)
        if n1 > n2 {
            return true
        }
        if n1 < n2 {
            return false
        }
        // are equal so check the next element
    }
    return false // are equal so not greater
}

// http://stackoverflow.com/questions/5868567/unique-identifier-of-a-mac
func getMacSerialNumber() -> String {
    let platformExpert: io_service_t = IOServiceGetMatchingService(kIOMasterPortDefault, IOServiceMatching("IOPlatformExpertDevice"));
    if platformExpert == 0 {
        return ""
    }
    let serialNumberAsCFString = IORegistryEntryCreateCFProperty(platformExpert, kIOPlatformSerialNumberKey as CFString, kCFAllocatorDefault, 0);
    IOObjectRelease(platformExpert);
    // Take the unretained value of the unmanaged-any-object
    // (so we're not responsible for releasing it)
    // and pass it back as a String or, if it fails, an empty string
    return (serialNumberAsCFString!.takeUnretainedValue() as? String) ?? ""
}

// http://stackoverflow.com/questions/31835418/how-to-get-mac-address-from-osx-with-swift
// Returns an iterator containing the primary (built-in) Ethernet interface. The caller is responsible for
// releasing the iterator after the caller is done with it.
func findEthernetInterfaces() -> io_iterator_t? {
    
    guard let matchingDictUM = IOServiceMatching("IOEthernetInterface") else {
        return nil
    }
    // Note that another option here would be:
    // matchingDict = IOBSDMatching("en0");
    // but en0: isn't necessarily the primary interface, especially on systems with multiple Ethernet ports.
    let matchingDict = matchingDictUM as NSMutableDictionary
    matchingDict["IOPropertyMatch"] = [ "IOPrimaryInterface" : true]
    
    var matchingServices : io_iterator_t = 0
    if IOServiceGetMatchingServices(kIOMasterPortDefault, matchingDict, &matchingServices) != KERN_SUCCESS {
        return nil
    }
    
    return matchingServices
}

// Given an iterator across a set of Ethernet interfaces, return the MAC address of the last one.
// If no interfaces are found the MAC address is set to an empty string.
// Here the iterator should contain just the primary interface.
func getMACAddress(_ intfIterator : io_iterator_t) -> [UInt8]? {
    
    var macAddress : [UInt8]?
    
    var intfService = IOIteratorNext(intfIterator)
    while intfService != 0 {
        
        var controllerService : io_object_t = 0
        if IORegistryEntryGetParentEntry(intfService, "IOService", &controllerService) == KERN_SUCCESS {
            
            let dataUM = IORegistryEntryCreateCFProperty(controllerService, "IOMACAddress" as CFString, kCFAllocatorDefault, 0)
            if dataUM != nil {
                let data = dataUM?.takeRetainedValue() as! Data
                macAddress = [0, 0, 0, 0, 0, 0]
                (data as NSData).getBytes(&macAddress!, length: macAddress!.count)
            }
            IOObjectRelease(controllerService)
        }
        
        IOObjectRelease(intfService)
        intfService = IOIteratorNext(intfIterator)
    }
    
    return macAddress
}

// on my Mac Pro it returns mac of en0 interface even though I'm actually using en2
// wifi adapter. I'm hoping this order is fixed on a given computer
// (and doesn't, for example, changes if a user switches wifi on/off).
// Maybe I should just ask for a fixed "en0" and do this if that fails?
func getMACAddressString() -> String {
    guard let intfIterator = findEthernetInterfaces() else {
        return ""
    }
    var res = ""
    if let macAddress = getMACAddress(intfIterator) {
        let converted = macAddress.map( { String(format:"%02x", $0) } )
        res = converted.joined(separator: ":")
    }
    
    IOObjectRelease(intfIterator)
    return res;
}

// we give precedence to MAC address because we got a report of getMacSerialNumber()
// crashing (might have fixed that, though)
func getUniqueMachineId() -> String {
    var res = getMACAddressString()
    if res == "" {
        log("getUniqueMachineId: getMACAddressString() failed")
        res = getMacSerialNumber()
    }
    if res == "" {
        log("getUniqueMachineId: getMacSerialNumber() failed")
        res = "unknown"
    }
    return res
}

/*
// if we decide to support 10.9, we'll need this version
// return os version in the "10.11.1" form
func getOsVersion2() -> String {
if #available(OSX 10.10, *) {
let os = NSProcessInfo().operatingSystemVersion
return "\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)"
} else {
let ver = rint(NSAppKitVersionNumber)
if ver >= Double(NSAppKitVersionNumber10_10_Max) {
return "10.10.5+"
}
if ver >= Double(NSAppKitVersionNumber10_10_5) {
return "10.10.5"
}
if ver >= Double(NSAppKitVersionNumber10_10_4) {
return "10.10.4"
}
if ver >= Double(NSAppKitVersionNumber10_10_3) {
return "10.10.3"
}
if ver >= Double(NSAppKitVersionNumber10_10_2) {
return "10.10.2"
}
if ver >= Double(NSAppKitVersionNumber10_10) {
return "10.10"
}
if ver >= Double(NSAppKitVersionNumber10_9) {
return "10.9"
}
if ver >= Double(NSAppKitVersionNumber10_8) {
return "10.8"
}
return "unknown: \(ver)"
}
}
*/

func getOsVersion() -> String {
    let os = ProcessInfo().operatingSystemVersion
    return "\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)"
}

func getHostName() -> String {
    return ProcessInfo.processInfo.hostName
}
