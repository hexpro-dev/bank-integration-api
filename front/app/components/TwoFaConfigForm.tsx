import { useState } from "react";
import { Input, Label, ListBox, Select, TextField } from "@heroui/react";

export interface TwoFaFormState {
  method: string;
  smsProvider: string;
  apiKey: string;
  apiSecret: string;
  phoneNumber: string;
  forwardTo: string;
  notificationEmail: string;
  hasApiKey?: boolean;
  hasApiSecret?: boolean;
}

export const EMPTY_2FA: TwoFaFormState = {
  method: "sms",
  smsProvider: "",
  apiKey: "",
  apiSecret: "",
  phoneNumber: "",
  forwardTo: "",
  notificationEmail: "",
};

interface TwoFaConfigFormProps {
  value: TwoFaFormState;
  onChange: (field: string, value: string) => void;
  webhookUrl?: string | null;
}

function WebhookUrlField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Webhook URL</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-default-100 px-3 py-2 rounded-lg text-xs font-mono break-all select-all">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg bg-default-100 hover:bg-default-200 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-default-400">
        Set this as your SMS provider's incoming message webhook.
        For Twilio, configure it as the "A message comes in" webhook URL on your phone number.
        For Plivo, set it as the Message URL on your application.
      </p>
    </div>
  );
}

export default function TwoFaConfigForm({
  value,
  onChange,
  webhookUrl,
}: TwoFaConfigFormProps) {
  return (
    <div className="space-y-3">
      <Select
        selectedKey={value.method}
        onSelectionChange={(key) => onChange("method", key as string)}
      >
        <Label>Method</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="sms" textValue="SMS">
              SMS
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="app" textValue="App-based">
              App-based
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>

      {value.method === "sms" && (
        <>
          <Select
            selectedKey={value.smsProvider}
            onSelectionChange={(key) => onChange("smsProvider", key as string)}
          >
            <Label>SMS Provider</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="twilio" textValue="Twilio">
                  Twilio
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="plivo" textValue="Plivo">
                  Plivo
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              fullWidth
              onChange={(v) => onChange("apiKey", v)}
            >
              <Label>
                API Key
                {value.hasApiKey && !value.apiKey && (
                  <span className="text-success text-xs font-normal ml-1.5">
                    (set)
                  </span>
                )}
              </Label>
              <Input
                value={value.apiKey}
                placeholder={value.hasApiKey ? "Leave blank to keep" : ""}
              />
            </TextField>
            <TextField
              fullWidth
              type="password"
              onChange={(v) => onChange("apiSecret", v)}
            >
              <Label>
                API Secret
                {value.hasApiSecret && !value.apiSecret && (
                  <span className="text-success text-xs font-normal ml-1.5">
                    (set)
                  </span>
                )}
              </Label>
              <Input
                value={value.apiSecret}
                placeholder={value.hasApiSecret ? "Leave blank to keep" : ""}
              />
            </TextField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              fullWidth
              onChange={(v) => onChange("phoneNumber", v)}
            >
              <Label>Phone Number</Label>
              <Input value={value.phoneNumber} placeholder="+61..." />
            </TextField>
            <TextField
              fullWidth
              onChange={(v) => onChange("forwardTo", v)}
            >
              <Label>Forward To</Label>
              <Input value={value.forwardTo} placeholder="+61..." />
            </TextField>
          </div>

          {webhookUrl ? (
            <WebhookUrlField url={webhookUrl} />
          ) : (
            <p className="text-xs text-default-400">
              The webhook URL will be generated after saving.
            </p>
          )}
        </>
      )}

      <TextField
        fullWidth
        type="email"
        onChange={(v) => onChange("notificationEmail", v)}
      >
        <Label>Notification Email</Label>
        <Input value={value.notificationEmail} />
      </TextField>
    </div>
  );
}
