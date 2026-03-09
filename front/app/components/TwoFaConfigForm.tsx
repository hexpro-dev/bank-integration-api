import { useState } from "react";
import { Button, Chip, Input, Label, ListBox, Select, TextField } from "@heroui/react";

export interface TwoFaFormState {
  method: string;
  smsProvider: string;
  apiKey: string;
  apiSecret: string;
  phoneNumber: string;
  forwardTo: string[];
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
  forwardTo: [],
  notificationEmail: "",
};

interface TwoFaConfigFormProps {
  value: TwoFaFormState;
  onChange: (field: string, value: string | string[]) => void;
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

function ForwardToField({
  numbers,
  onUpdate,
}: {
  numbers: string[];
  onUpdate: (updated: string[]) => void;
}) {
  const [newNumber, setNewNumber] = useState("");

  function addNumber() {
    const trimmed = newNumber.trim();
    if (!trimmed || numbers.includes(trimmed)) return;
    onUpdate([...numbers, trimmed]);
    setNewNumber("");
  }

  function removeNumber(idx: number) {
    onUpdate(numbers.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Forward To</p>
      {numbers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {numbers.map((num, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <Chip size="sm" variant="soft">
                {num}
              </Chip>
              <button
                type="button"
                className="text-default-400 hover:text-default-700 text-xs leading-none"
                onClick={() => removeNumber(idx)}
                aria-label={`Remove ${num}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end">
        <TextField fullWidth onChange={setNewNumber} className="flex-1">
          <Label className="sr-only">Add forward number</Label>
          <Input
            value={newNumber}
            placeholder="+61..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addNumber();
              }
            }}
          />
        </TextField>
        <Button size="sm" variant="secondary" onPress={addNumber}>
          Add
        </Button>
      </div>
      <p className="text-xs text-default-400">
        SMS messages will be forwarded to all numbers listed above.
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

          <TextField
            fullWidth
            onChange={(v) => onChange("phoneNumber", v)}
          >
            <Label>Phone Number</Label>
            <Input value={value.phoneNumber} placeholder="+61..." />
          </TextField>

          <ForwardToField
            numbers={value.forwardTo}
            onUpdate={(updated) => onChange("forwardTo", updated)}
          />

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
