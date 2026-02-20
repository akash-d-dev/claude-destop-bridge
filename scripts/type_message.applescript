on run argv
    if (count of argv) = 0 then
        return
    end if
    set msg to item 1 of argv
    
    tell application "Claude"
        activate
    end tell
    
    delay 0.5
    
    tell application "System Events"
        -- Ensure Claude is frontmost
        set frontmost of process "Claude" to true
        delay 0.2
        
        -- Type the message
        keystroke msg
        delay 0.5
        
        -- Press Return
        keystroke return
    end tell
end run
