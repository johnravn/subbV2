import clsx from 'clsx'
import { For } from 'solid-js'
import { useStyles } from '../styles/use-styles'
import { useDevtoolsState } from '../context/use-devtools-context'
import { tabs } from '../tabs'

interface TabsProps {
  toggleOpen: () => void
}

export const Tabs = (props: TabsProps) => {
  const styles = useStyles()
  const { state, setState } = useDevtoolsState()

  return (
    <div class={styles().tabContainer}>
      <For each={tabs}>
        {(tab) => (
          <button
            type="button"
            onClick={() => setState({ activeTab: tab.id })}
            class={clsx(styles().tab, { active: state().activeTab === tab.id })}
          >
            {tab.icon}
          </button>
        )}
      </For>
      <button
        type="button"
        class={clsx(styles().tab, 'close')}
        onClick={() => props.toggleOpen()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}
