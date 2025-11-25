import { AccountHolderForm } from "@/components/account-holder-form";

export default function AccountHoldersPage() {
  const handleSave = (data: any) => {
    console.log("Account holder saved:", data);
    // Here would be API call to save the account holder
  };

  const handleSaveHouse = (holderId: string, data: any) => {
    console.log("Betting house saved:", data, "for holder:", holderId);
    // Here would be API call to save the betting house
  };

  return (
    <div className="p-6">
      <AccountHolderForm 
        onSave={handleSave}
        onSaveHouse={handleSaveHouse}
      />
    </div>
  );
}