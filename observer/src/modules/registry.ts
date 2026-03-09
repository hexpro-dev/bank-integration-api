import type { BankModule } from "./base.js";
import type { Bank } from "../types.js";
import { AnzModule } from "./anz/index.js";
import { CommBankModule } from "./commbank/index.js";
import { NabModule } from "./nab/index.js";
import { WestpacModule } from "./westpac/index.js";

const moduleRegistry: Record<Bank, () => BankModule> = {
	anz: () => new AnzModule(),
	commbank: () => new CommBankModule(),
	nab: () => new NabModule(),
	westpac: () => new WestpacModule(),
};

export function getModuleForBank(bank: Bank): BankModule {
	const factory = moduleRegistry[bank];
	if (!factory) {
		throw new Error(`No module registered for bank: ${bank}`);
	}
	return factory();
}
