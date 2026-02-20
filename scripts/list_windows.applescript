on replace_chars(theText, oldDelim, newDelim)
    set AppleScript's text item delimiters to oldDelim
    set textItems to every text item of theText
    set AppleScript's text item delimiters to newDelim
    set updatedText to textItems as text
    set AppleScript's text item delimiters to ""
    return updatedText
end replace_chars

on sanitize_text(rawText)
    set cleanText to rawText as text
    set cleanText to replace_chars(cleanText, linefeed, " ")
    set cleanText to replace_chars(cleanText, return, " ")
    set cleanText to replace_chars(cleanText, tab, " ")
    return cleanText
end sanitize_text

set outputLines to {}

tell application "System Events"
    repeat with procRef in (every process whose background only is false)
        set appName to ""
        try
            set appName to sanitize_text(name of procRef as text)
        end try

        try
            repeat with winRef in windows of procRef
                try
                    set winID to value of attribute "AXWindowNumber" of winRef
                    if winID is missing value then
                        set winID to ""
                    end if
                    
                    set winTitle to ""
                    try
                        set winTitle to sanitize_text(name of winRef as text)
                    end try
                    
                    if (winID as text) is not "" then
                        set end of outputLines to (winID as text) & tab & appName & tab & winTitle
                    end if
                end try
            end repeat
        end try
    end repeat
end tell

set AppleScript's text item delimiters to linefeed
set outputText to outputLines as text
set AppleScript's text item delimiters to ""
return outputText
