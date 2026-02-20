tell application "Claude"
    activate
end tell

delay 0.2

tell application "System Events"
    set frontmost of process "Claude" to true
    delay 0.1

    repeat 4 times
        key code 126
        delay 0.03
    end repeat
end tell
