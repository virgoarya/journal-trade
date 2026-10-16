import { ComponentMeta, ComponentStory } from "@storybook/react";
import { DashboardCard } from "../src/components/DashboardCard";

export default {
  title: "Components/DashboardCard",
  component: DashboardCard,
  argTypes: {
    variant: { control: { type: "select", options: ["default", "profit", "loss", "warning"] } },
    onClick: { action: "clicked" },
  },
} as ComponentMeta<typeof DashboardCard>;

const Template: ComponentStory<typeof DashboardCard> = (args) => <DashboardCard {...args} />;

export const Default = Template.bind({});
Default.args = {
  title: "Net Profit/Loss",
  value: "+$4,281",
  change: { value: 12.4, label: "THIS MONTH", trend: "up" },
  subtitle: "USD",
  icon: <span className="material-symbols-outlined">trending_up</span>,
};

export const Loss = Template.bind({});
Loss.args = {
  title: "Drawdown",
  value: "-8.2%",
  change: { value: -5.1, label: "THIS MONTH", trend: "down" },
  variant: "loss",
  icon: <span className="material-symbols-outlined">trending_down</span>,
};
