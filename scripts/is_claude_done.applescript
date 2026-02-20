tell application "System Events"
    if exists (process "Claude") then
        tell process "Claude"
            if exists (window 1) then
                try
                    -- When generating, button 2 has a nested group inside it
                    -- group 1 of group 1 of button 2 only exists while Claude is generating
                    if exists (group 1 of group 1 of button 2 of window 1) then
                        return "false" -- still generating
                    else
                        return "true" -- done
                    end if
                on error
                    return "true"
                end try
            end if
        end tell
    end if
    return "true"
end tell
