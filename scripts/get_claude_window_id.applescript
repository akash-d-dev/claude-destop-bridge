tell application "System Events"
    if exists (process "Claude") then
        tell process "Claude"
            if exists (window 1) then
                try
                    set winID to value of attribute "AXWindowNumber" of window 1
                    return winID as text
                on error
                    return ""
                end try
            end if
        end tell
    end if
end tell

return ""
