import { ComponentMeta, ComponentStory } from "@storybook/react";
import { SignalChart } from "../src/components/SignalChart";

export default {
  title: "Components/SignalChart",
  component: SignalChart,
  argTypes: {
    height: { control: { type: "range", min: 200, max: 800, step: 10 } },
    showSignals: { control: "boolean" },
    compact: { control: "boolean" },
  },
} as ComponentMeta<typeof SignalChart>;

const sampleData = Array.from({ length: 30 }, (_, i) => ({
  timestamp: new Date(Date.now() - (30 - i) * 60000).toISOString(),
  price: 1700 + Math.sin(i / 3) * 15 + Math.random() * 5,
  signal: i % 7 === 0 ? "buy" : i % 11 === 0 ? "sell" : undefined,
  confidence: Math.round(Math.random() * 100),
  pnl: i % 7 === 0 ? 12 : i % 11 === 0 ? -8 : undefined,
}));

const Template: ComponentStory<typeof SignalChart> = (args) => <SignalChart {...args} />;

export const Default = Template.bind({});
Default.args = {
  data: sampleData,
  symbol: "XAU/USD",
  timeframe: "H1",
  height: 400,
  showSignals: true,
  compact: false,
};
