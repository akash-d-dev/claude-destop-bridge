tell application "Claude"
    activate
end tell

delay 0.25

tell application "System Events"
    set frontmost of process "Claude" to true
    delay 0.15

    set clickX to 640
    set clickY to 360
    try
        tell process "Claude"
            set frontWindow to first window whose value of attribute "AXMain" is true
            try
                perform action "AXRaise" of frontWindow
            end try
            set {winX, winY} to position of frontWindow
            set {winW, winH} to size of frontWindow
        end tell
        if winW > 0 and winH > 0 then
            set clickX to winX + (winW div 2)
            set clickY to winY + (winH div 2)
        end if
    end try

    -- Mirror manual behavior: click center to remove input focus.
    click at {clickX, clickY}
    delay 0.12
    click at {clickX, clickY}
    delay 0.2

    key code 125 using {command down}
end tell
