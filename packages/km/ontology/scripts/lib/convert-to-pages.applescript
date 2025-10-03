#!/usr/bin/osascript

(*
Convert DOCX to Pages Format

This AppleScript automates the conversion of Microsoft Word DOCX files
to Apple Pages format.

Usage:
  osascript convert-to-pages.applescript <input.docx> <output.pages>

Arguments:
  input.docx   - Path to the DOCX file to convert
  output.pages - Path for the output Pages file

Example:
  osascript convert-to-pages.applescript ~/Documents/report.docx ~/Documents/report.pages

Notes:
  - Pages must be installed
  - The script will open Pages, perform the conversion, and close the document
  - Any conversion warnings will be ignored
  - The script waits for Pages to fully load the document before exporting
*)

on run argv
	if (count of argv) < 2 then
		display dialog "Usage: osascript convert-to-pages.applescript <input.docx> <output.pages>" buttons {"OK"} default button 1 with icon stop
		return
	end if

	set inputPath to item 1 of argv
	set outputPath to item 2 of argv

	try
		tell application "Pages"
			-- Activate Pages
			activate

			-- Open the DOCX file
			set docxFile to POSIX file inputPath
			set theDoc to open docxFile

			-- Wait for document to fully load
			delay 2

			-- Export to Pages format
			set pagesFile to POSIX file outputPath
			export theDoc to pagesFile as Pages

			-- Close document without saving (it's already exported)
			close theDoc saving no

		end tell

		return "Successfully converted: " & inputPath & " → " & outputPath

	on error errMsg number errNum
		display dialog "Conversion failed: " & errMsg & " (Error " & errNum & ")" buttons {"OK"} default button 1 with icon stop
		error "Conversion failed: " & errMsg number errNum
	end try
end run
