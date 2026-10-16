import { ComponentMeta, ComponentStory } from "@storybook/react";
import { JournalEntryForm } from "../src/components/JournalEntryForm";

export default {
  title: "Components/JournalEntryForm",
  component: JournalEntryForm,
  argTypes: {
    loading: { control: "boolean" },
    submitText: { control: "text" },
  },
} as ComponentMeta<typeof JournalEntryForm>;

const Template: ComponentStory<typeof JournalEntryForm> = (args) => <JournalEntryForm {...args} onSubmit={(data) => console.log(data)} />;

export const Default = Template.bind({});
Default.args = {
  loading: false,
  submitText: "Log Trade",
};
