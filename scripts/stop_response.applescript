tell application "Claude"
    activate
end tell

delay 0.2

tell application "System Events"
    set frontmost of process "Claude" to true
    delay 0.1

    -- Press Escape to stop current response
    key code 53
end tell
