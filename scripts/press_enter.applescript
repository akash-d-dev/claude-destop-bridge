tell application "Claude"
    activate
end tell

delay 0.08

tell application "System Events"
    set frontmost of process "Claude" to true
    delay 0.04
    key code 36
end tell
