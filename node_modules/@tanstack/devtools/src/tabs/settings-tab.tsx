import { Show } from 'solid-js'
import { Checkbox, Input, Select } from '@tanstack/devtools-ui'
import { useDevtoolsSettings } from '../context/use-devtools-context'
import { uppercaseFirstLetter } from '../utils/sanitize'
import { useStyles } from '../styles/use-styles'

export const SettingsTab = () => {
  const { setSettings, settings } = useDevtoolsSettings()
  const styles = useStyles()

  return (
    <div class={styles().settingsContainer}>
      {/* General Settings */}
      <div class={styles().settingsSection}>
        <h3 class={styles().sectionTitle}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class={styles().sectionIcon}
          >
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          General
        </h3>
        <p class={styles().sectionDescription}>
          Configure general behavior of the devtools panel.
        </p>
        <div class={styles().settingsGroup}>
          <Checkbox
            label="Default open"
            description="Automatically open the devtools panel when the page loads"
            onChange={() =>
              setSettings({ defaultOpen: !settings().defaultOpen })
            }
            checked={settings().defaultOpen}
          />
          <Checkbox
            label="Hide trigger until hovered"
            description="Keep the devtools trigger button hidden until you hover over its area"
            onChange={() =>
              setSettings({ hideUntilHover: !settings().hideUntilHover })
            }
            checked={settings().hideUntilHover}
          />
        </div>
      </div>

      {/* URL Flag Settings */}
      <div class={styles().settingsSection}>
        <h3 class={styles().sectionTitle}>
          <svg
            class={styles().sectionIcon}
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 17H7A5 5 0 0 1 7 7h2" />
            <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
            <line x1="8" x2="16" y1="12" y2="12" />
          </svg>
          URL Configuration
        </h3>
        <p class={styles().sectionDescription}>
          Control when devtools are available based on URL parameters.
        </p>
        <div class={styles().settingsGroup}>
          <Checkbox
            label="Require URL Flag"
            description="Only show devtools when a specific URL parameter is present"
            checked={settings().requireUrlFlag}
            onChange={(checked) =>
              setSettings({
                requireUrlFlag: checked,
              })
            }
          />
          <Show when={settings().requireUrlFlag}>
            <div class={styles().conditionalSetting}>
              <Input
                label="URL flag"
                description="Enter the URL parameter name (e.g., 'debug' for ?debug=true)"
                placeholder="debug"
                value={settings().urlFlag}
                onChange={(e) =>
                  setSettings({
                    urlFlag: e,
                  })
                }
              />
            </div>
          </Show>
        </div>
      </div>

      {/* Keyboard Settings */}
      <div class={styles().settingsSection}>
        <h3 class={styles().sectionTitle}>
          <svg
            class={styles().sectionIcon}
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M10 8h.01" />
            <path d="M12 12h.01" />
            <path d="M14 8h.01" />
            <path d="M16 12h.01" />
            <path d="M18 8h.01" />
            <path d="M6 8h.01" />
            <path d="M7 16h10" />
            <path d="M8 12h.01" />
            <rect width="20" height="16" x="2" y="4" rx="2" />
          </svg>
          Keyboard
        </h3>
        <p class={styles().sectionDescription}>
          Customize keyboard shortcuts for quick access.
        </p>
        <div class={styles().settingsGroup}>
          <Input
            label="Hotkey to open/close devtools"
            description="Use '+' to combine keys (e.g., 'Ctrl+Shift+D' or 'Alt+D')"
            placeholder="Ctrl+Shift+D"
            value={settings().openHotkey.join('+')}
            onChange={(e) =>
              setSettings({
                openHotkey: e
                  .split('+')
                  .map((key) => uppercaseFirstLetter(key))
                  .filter(Boolean),
              })
            }
          />
        </div>
      </div>

      {/* Position Settings */}
      <div class={styles().settingsSection}>
        <h3 class={styles().sectionTitle}>
          <svg
            class={styles().sectionIcon}
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Position
        </h3>
        <p class={styles().sectionDescription}>
          Adjust the position of the trigger button and devtools panel.
        </p>
        <div class={styles().settingsGroup}>
          <div class={styles().settingRow}>
            <Select
              label="Trigger Position"
              options={[
                { label: 'Bottom Right', value: 'bottom-right' },
                { label: 'Bottom Left', value: 'bottom-left' },
                { label: 'Top Right', value: 'top-right' },
                { label: 'Top Left', value: 'top-left' },
                { label: 'Middle Right', value: 'middle-right' },
                { label: 'Middle Left', value: 'middle-left' },
              ]}
              value={settings().position}
              onChange={(value) =>
                setSettings({
                  position: value,
                })
              }
            />
            <Select
              label="Panel Position"
              value={settings().panelLocation}
              options={[
                { label: 'Top', value: 'top' },
                { label: 'Bottom', value: 'bottom' },
              ]}
              onChange={(value) =>
                setSettings({
                  panelLocation: value,
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
