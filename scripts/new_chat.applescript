tell application "Claude"
    activate
end tell

delay 0.5

tell application "System Events"
    set frontmost of process "Claude" to true
    delay 0.2
    
    -- Press Cmd+Shift+O
    keystroke "o" using {command down, shift down}
end tell
