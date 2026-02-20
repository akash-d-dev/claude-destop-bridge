tell application "Claude"
    activate
end tell

delay 0.2

tell application "System Events"
    set frontmost of process "Claude" to true
    delay 0.1

    -- Focus input, then select all and clear.
    keystroke "a"
    delay 0.05
    keystroke "a" using {command down}
    delay 0.05
    key code 51
end tell
