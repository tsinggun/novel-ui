Option Explicit
Dim fso, sh, base, nodeExe, cmdLine
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = base
nodeExe = FindNode(base)
If nodeExe = "" Then
  MsgBox "Node.js not found." & vbCrLf & vbCrLf & "Install Node.js 20+ from https://nodejs.org, then double-click this file again.", 16, "Novel Builder"
  WScript.Quit 1
End If
cmdLine = """" & nodeExe & """ """ & base & "\client\server.mjs"""
sh.Run cmdLine, 0, False
Function FindNode(base)
  Dim candidates, i, p
  candidates = Array( _
    "C:\nvm4w\nodejs\node.exe", _
    sh.ExpandEnvironmentStrings("%ProgramFiles%\nodejs\node.exe"), _
    sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%\nodejs\node.exe"), _
    sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\nodejs\node.exe") _
  )
  For i = 0 To UBound(candidates)
    If fso.FileExists(candidates(i)) Then
      FindNode = candidates(i)
      Exit Function
    End If
  Next
  FindNode = ""
End Function
