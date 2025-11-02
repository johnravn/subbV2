// src/features/company/components/CompanyPersonalizationTab.tsx
import * as React from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { MessageText } from 'iconoir-react'
import EditWelcomeMatterDialog from './dialogs/EditWelcomeMatterDialog'
import AccentColorPicker from './AccentColorPicker'

export default function CompanyPersonalizationTab() {
  const [welcomeMatterOpen, setWelcomeMatterOpen] = React.useState(false)

  return (
    <Card
      size="4"
      style={{ minHeight: 0, overflow: 'auto' }}
    >
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Flex direction="column" gap="4" p="4">
          <Heading size="4" mb="2">
            Personalization
          </Heading>

          {/* Welcome matter section */}
          <Box>
            <Flex align="center" gap="3" mb="2">
              <Text as="div" size="2" weight="bold">
                Welcome matter
              </Text>
              <Button
                size="2"
                variant="soft"
                onClick={() => setWelcomeMatterOpen(true)}
              >
                <MessageText />
                Edit
              </Button>
            </Flex>
            <Text as="div" size="1" color="gray" mb="2">
              Message sent to all users when they are added to this company
            </Text>
            <EditWelcomeMatterDialog
              open={welcomeMatterOpen}
              onOpenChange={setWelcomeMatterOpen}
              onSaved={() => {}}
            />
          </Box>

          <Separator my="3" />

          {/* Accent Color Picker */}
          <AccentColorPicker />
        </Flex>
      </div>
    </Card>
  )
}
