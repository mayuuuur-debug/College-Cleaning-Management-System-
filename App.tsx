/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  CampusZone, 
  StaffMember, 
  CleaningIncident, 
  InspectionAudit, 
  InventoryItem, 
  IncidentStatus, 
  StaffStatus 
} from "./types";
import { 
  loadStoredData, 
  saveZones, 
  saveStaff, 
  saveIncidents, 
  saveAudits, 
  saveInventory, 
  resetAllData 
} from "./utils/storage";

// Components
import { Header } from "./components/Header";
import { CollegeHeroHeader } from "./components/CollegeHeroHeader";
import { OverviewTab } from "./components/OverviewTab";
import { ZonesTab } from "./components/ZonesTab";
import { IncidentsTab } from "./components/IncidentsTab";
import { AISanitationAdvisor } from "./components/AISanitationAdvisor";
import { AuditsTab } from "./components/AuditsTab";
import { StaffTab } from "./components/StaffTab";
import { InventoryTab } from "./components/InventoryTab";

// Modals
import { ReportIssueModal } from "./components/ReportIssueModal";
import { QRScannerModal } from "./components/QRScannerModal";
import { NewAuditModal } from "./components/NewAuditModal";
import { AssignStaffModal } from "./components/AssignStaffModal";
import { AIProtocolModal } from "./components/AIProtocolModal";

export default function App() {
  // Main state loaded from storage
  const [dataLoaded, setDataLoaded] = useState(false);
  const [zones, setZones] = useState<CampusZone[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [incidents, setIncidents] = useState<CleaningIncident[]>([]);
  const [audits, setAudits] = useState<InspectionAudit[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Modal States
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);

  // Selected Entities for Modals
  const [selectedIncidentForAssign, setSelectedIncidentForAssign] = useState<CleaningIncident | null>(null);
  const [selectedIncidentForProtocol, setSelectedIncidentForProtocol] = useState<CleaningIncident | null>(null);
  const [preselectedZoneCodeForReport, setPreselectedZoneCodeForReport] = useState<string | undefined>(undefined);

  // AI loading state
  const [isAILoading, setIsAILoading] = useState(false);
  const [analyzingIncidentId, setAnalyzingIncidentId] = useState<string | undefined>(undefined);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Initial load
  useEffect(() => {
    const loaded = loadStoredData();
    setZones(loaded.zones);
    setStaff(loaded.staff);
    setIncidents(loaded.incidents);
    setAudits(loaded.audits);
    setInventory(loaded.inventory);
    setDataLoaded(true);
  }, []);

  // Sync back to storage on updates
  useEffect(() => {
    if (dataLoaded) saveZones(zones);
  }, [zones, dataLoaded]);

  useEffect(() => {
    if (dataLoaded) saveStaff(staff);
  }, [staff, dataLoaded]);

  useEffect(() => {
    if (dataLoaded) saveIncidents(incidents);
  }, [incidents, dataLoaded]);

  useEffect(() => {
    if (dataLoaded) saveAudits(audits);
  }, [audits, dataLoaded]);

  useEffect(() => {
    if (dataLoaded) saveInventory(inventory);
  }, [inventory, dataLoaded]);

  // Handler: Report new issue
  const handleReportSubmit = async (formData: any) => {
    const newId = `inc-${Date.now()}`;
    const newTicket = `CLN-2026-${Math.floor(100 + Math.random() * 900)}`;

    const newIncident: CleaningIncident = {
      id: newId,
      ticketNumber: newTicket,
      title: formData.title,
      location: formData.location,
      zoneId: formData.zoneId,
      building: formData.building,
      category: formData.category,
      urgency: formData.urgency,
      description: formData.description,
      reporterName: formData.reporterName,
      reporterRole: formData.reporterRole,
      reportedAt: "Just now (" + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ")",
      status: "Pending",
    };

    // If linked to a specific zone, flag that zone
    if (formData.zoneId) {
      setZones((prev) =>
        prev.map((z) =>
          z.id === formData.zoneId
            ? {
                ...z,
                status: "Needs Cleaning",
                urgentAlert: formData.title,
                cleanlinessScore: Math.max(40, z.cleanlinessScore - 20),
              }
            : z
        )
      );
    }

    setIncidents((prev) => [newIncident, ...prev]);
    showToast(`Sanitation ticket ${newTicket} submitted successfully.`);

    // If auto AI analysis requested, trigger it right away
    if (formData.runAIAnalysis) {
      triggerAIAnalysisForIncident(newIncident);
    }
  };

  // Helper to trigger AI analysis
  const triggerAIAnalysisForIncident = async (incident: CleaningIncident) => {
    setIsAILoading(true);
    setAnalyzingIncidentId(incident.id);
    try {
      const res = await fetch("/api/ai/analyze-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: incident.title,
          location: incident.location,
          category: incident.category,
          description: incident.description,
          urgency: incident.urgency,
        }),
      });
      const data = await res.json();
      if (data.protocol) {
        setIncidents((prev) =>
          prev.map((i) => (i.id === incident.id ? { ...i, aiProtocol: data.protocol } : i))
        );
        showToast(`AI Sanitation Protocol generated for ${incident.ticketNumber}`);
      }
    } catch (e) {
      console.error("AI fetch error:", e);
    } finally {
      setIsAILoading(false);
      setAnalyzingIncidentId(undefined);
    }
  };

  // Handler: Mark Zone Cleaned
  const handleMarkZoneCleaned = (zoneId: string) => {
    const timeStr = "Today at " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setZones((prev) =>
      prev.map((z) =>
        z.id === zoneId
          ? {
              ...z,
              status: "Clean",
              cleanlinessScore: Math.min(100, Math.max(92, z.cleanlinessScore + 25)),
              lastCleaned: timeStr,
              urgentAlert: undefined,
            }
          : z
      )
    );
    showToast("Zone cleaning verified and cleanliness score restored.");
  };

  // Handler: Assign Staff to Zone
  const handleAssignStaffToZone = (zoneId: string, staffId: string) => {
    const person = staff.find((s) => s.id === staffId);
    setZones((prev) =>
      prev.map((z) =>
        z.id === zoneId
          ? {
              ...z,
              assignedStaffId: staffId || undefined,
              assignedStaffName: person ? `${person.name} (${person.role})` : undefined,
            }
          : z
      )
    );
    if (person) {
      showToast(`Assigned ${person.name} to zone coverage.`);
    }
  };

  // Handler: Assign Staff to Incident
  const handleAssignStaffToIncident = (incidentId: string, staffId: string) => {
    const person = staff.find((s) => s.id === staffId);
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              status: inc.status === "Pending" ? "Assigned" : inc.status,
              assignedStaffId: staffId,
              assignedStaffName: person?.name,
            }
          : inc
      )
    );

    // Update staff status to Dispatched
    if (person) {
      setStaff((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, status: "Dispatched" } : s))
      );
      showToast(`Dispatched ${person.name} to ticket.`);
    }
  };

  // Handler: Update Incident Status
  const handleUpdateIncidentStatus = (
    incidentId: string,
    newStatus: IncidentStatus,
    notes?: string
  ) => {
    const resolvedTime =
      newStatus === "Resolved"
        ? "Today at " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : undefined;

    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === incidentId) {
          return {
            ...inc,
            status: newStatus,
            resolutionNotes: notes || inc.resolutionNotes,
            resolvedAt: resolvedTime || inc.resolvedAt,
          };
        }
        return inc;
      })
    );

    // Increment completed tasks for assigned staff if resolved
    if (newStatus === "Resolved") {
      const targetInc = incidents.find((i) => i.id === incidentId);
      if (targetInc?.assignedStaffId) {
        setStaff((prev) =>
          prev.map((s) =>
            s.id === targetInc.assignedStaffId
              ? { ...s, tasksCompletedToday: s.tasksCompletedToday + 1, status: "On Duty" }
              : s
          )
        );
      }
      showToast("Sanitation issue marked as resolved.");
    } else {
      showToast(`Incident status changed to ${newStatus}`);
    }
  };

  // Handler: Rate Incident
  const handleRateIncident = (incidentId: string, rating: number, comment?: string) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId ? { ...inc, rating, ratingComment: comment } : inc
      )
    );
    showToast(`Thank you for submitting a ${rating}-star feedback rating.`);
  };

  // Handler: Conduct New Audit
  const handleConductAudit = (newAudit: InspectionAudit) => {
    setAudits((prev) => [newAudit, ...prev]);

    // Update the audited zone's cleanliness score directly
    setZones((prev) =>
      prev.map((z) =>
        z.id === newAudit.zoneId
          ? {
              ...z,
              cleanlinessScore: newAudit.overallScore,
              status: newAudit.overallScore >= 75 ? "Clean" : "Audit Required",
              lastCleaned: "Today at " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          : z
      )
    );

    showToast(`Audit certificate ${newAudit.auditNumber} recorded (${newAudit.overallScore}%).`);
  };

  // Handler: Update Staff Status
  const handleUpdateStaffStatus = (staffId: string, status: StaffStatus) => {
    setStaff((prev) => prev.map((s) => (s.id === staffId ? { ...s, status } : s)));
    showToast(`Staff status updated to ${status}.`);
  };

  // Handler: Dispatch Staff Quick
  const handleDispatchStaffQuick = (staffId: string) => {
    setStaff((prev) => prev.map((s) => (s.id === staffId ? { ...s, status: "Dispatched" } : s)));
    showToast("Staff dispatched to zone sector.");
  };

  // Handler: Update Inventory Stock
  const handleUpdateInventoryStock = (itemId: string, newStock: number) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              currentStock: newStock,
              status: newStock <= item.minThreshold ? "Low Stock" : "Adequate",
            }
          : item
      )
    );
    showToast("Consumable stock level adjusted.");
  };

  // Handler: Reorder Inventory
  const handleReorderInventory = (itemId: string) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, status: "Critical / Order Placed" } : item
      )
    );
    showToast("Purchase requisition dispatched to university procurement.");
  };

  // Handler: Reset Data
  const handleResetData = () => {
    if (window.confirm("Reset all campus zones, staff, and tickets to default demo state?")) {
      const reset = resetAllData();
      setZones(reset.zones);
      setStaff(reset.staff);
      setIncidents(reset.incidents);
      setAudits(reset.audits);
      setInventory(reset.inventory);
      showToast("Default university sanitation state restored.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        zones={zones}
        incidents={incidents}
        onOpenReportModal={() => {
          setPreselectedZoneCodeForReport(undefined);
          setIsReportModalOpen(true);
        }}
        onOpenQRModal={() => setIsQRModalOpen(true)}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
        onResetData={handleResetData}
      />

      {/* College Project Hero Banner */}
      <CollegeHeroHeader 
        onOpenReportModal={() => {
          setPreselectedZoneCodeForReport(undefined);
          setIsReportModalOpen(true);
        }}
        onOpenQRModal={() => setIsQRModalOpen(true)}
        onNavigateToTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "overview" && (
          <OverviewTab
            zones={zones}
            incidents={incidents}
            staff={staff}
            onNavigateToTab={setActiveTab}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            onOpenAssignModal={(inc) => {
              setSelectedIncidentForAssign(inc);
              setIsAssignModalOpen(true);
            }}
            onViewIncidentProtocol={(inc) => {
              setSelectedIncidentForProtocol(inc);
              setIsProtocolModalOpen(true);
            }}
            onQuickMarkCleaned={handleMarkZoneCleaned}
          />
        )}

        {activeTab === "zones" && (
          <ZonesTab
            zones={zones}
            staff={staff}
            onMarkCleaned={handleMarkZoneCleaned}
            onAssignStaff={handleAssignStaffToZone}
            onRequestCleaning={(zone) => {
              setPreselectedZoneCodeForReport(zone.code);
              setIsReportModalOpen(true);
            }}
            onScanQR={(zoneCode) => {
              setIsQRModalOpen(true);
            }}
          />
        )}

        {activeTab === "incidents" && (
          <IncidentsTab
            incidents={incidents}
            staff={staff}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            onUpdateStatus={handleUpdateIncidentStatus}
            onAssignStaff={(incidentId, staffId) => handleAssignStaffToIncident(incidentId, staffId)}
            onAnalyzeWithAI={(inc) => triggerAIAnalysisForIncident(inc)}
            onViewAIProtocol={(inc) => {
              setSelectedIncidentForProtocol(inc);
              setIsProtocolModalOpen(true);
            }}
            onSubmitRating={handleRateIncident}
            isAILoading={isAILoading}
            analyzingId={analyzingIncidentId}
          />
        )}

        {activeTab === "ai-advisor" && <AISanitationAdvisor />}

        {activeTab === "audits" && (
          <AuditsTab
            audits={audits}
            zones={zones}
            onOpenNewAuditModal={() => setIsAuditModalOpen(true)}
          />
        )}

        {activeTab === "staff" && (
          <StaffTab
            staff={staff}
            zones={zones}
            onUpdateStaffStatus={handleUpdateStaffStatus}
            onDispatchStaff={handleDispatchStaffQuick}
          />
        )}

        {activeTab === "inventory" && (
          <InventoryTab
            inventory={inventory}
            onUpdateStock={handleUpdateInventoryStock}
            onReorder={handleReorderInventory}
          />
        )}
      </main>

      {/* Modals */}
      <ReportIssueModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        zones={zones}
        preselectedZoneCode={preselectedZoneCodeForReport}
        onSubmit={handleReportSubmit}
      />

      <QRScannerModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        zones={zones}
        onMarkCleaned={handleMarkZoneCleaned}
        onRequestCleaning={(zone) => {
          setIsQRModalOpen(false);
          setPreselectedZoneCodeForReport(zone.code);
          setIsReportModalOpen(true);
        }}
      />

      <NewAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        zones={zones}
        onSubmitAudit={handleConductAudit}
      />

      <AssignStaffModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        incident={selectedIncidentForAssign}
        staff={staff}
        onConfirmAssign={handleAssignStaffToIncident}
      />

      <AIProtocolModal
        isOpen={isProtocolModalOpen}
        onClose={() => setIsProtocolModalOpen(false)}
        incident={selectedIncidentForProtocol}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <span className="font-bold text-slate-800">
              Government College of Engineering and Research, Avasari Khurd
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="text-emerald-700 font-medium">Campus Hygiene & Sanitation Initiative</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 font-medium">
            <span className="text-slate-400">Project Contributors:</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Karan Gavhane (25111030)</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Mayur Ghode (25111012)</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Vinayak Deokar (25111033)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
