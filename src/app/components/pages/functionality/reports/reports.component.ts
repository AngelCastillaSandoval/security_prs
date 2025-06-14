import { ReportModalComponent } from "./report-modal/report-modal.component"
import { ReportService } from "../../../../services/report.service"
import { RouterModule } from "@angular/router"
import { FormsModule, ReactiveFormsModule } from "@angular/forms"
import { Component, OnInit } from "@angular/core"
import { CommonModule } from "@angular/common"
import { ReportViewerModalComponent } from "./report-viewer-modal/report-viewer-modal.component"
import Swal from "sweetalert2"
import { ReportDto, ReportWorkshopDto, ReportWithWorkshopsDto } from "../../../../interfaces/report.interface"
import { DomSanitizer, SafeHtml } from "@angular/platform-browser"
import { ActivityService } from "../../../../services/ui/activity.service"
import { AuthService } from "../../../../auth/services/auth.service"

@Component({
  selector: "app-reports",
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    ReportViewerModalComponent,
    ReportModalComponent,
  ],
  templateUrl: "./reports.component.html",
  styleUrls: ["./reports.component.css"],
})
export class ReportsComponent implements OnInit {
  // Control del modal de descripción
  descriptionHtml: SafeHtml = ""
  showDescriptionModal = false
  isLoadingDescription = false

  // Datos
  reports: (ReportDto | ReportWithWorkshopsDto)[] = []
  filteredReports: (ReportDto | ReportWithWorkshopsDto)[] = []
  pagedReports: (ReportDto | ReportWithWorkshopsDto)[] = []

  // Filtros
  selectedTrimester = ""
  selectedYear = ""
  workshopDateStart = ""
  workshopDateEnd = ""
  activeFilter: "active" | "inactive" = "active"

  // Paginación
  currentPage = 1
  pageSize = 5
  totalPages = 1

  // Lista de años para el selector
  years: number[] = []

  // Utilidad matemática para el template
  Math = Math

  // Control del formulario modal
  showReportForm = false
  showReportViewer = false
  selectedReport: ReportDto | ReportWithWorkshopsDto | null = null
  isLoading = false
  isFilterLoading = false // Nuevo loading específico para filtros

  // Control del visor de imágenes
  showImageViewer = false
  currentImages: string[] = []
  currentImageIndex = 0

  // Control del visor de talleres
  showWorkshopViewer = false
  currentWorkshops: ReportWorkshopDto[] = []
  currentWorkshopIndex = 0
  loadingWorkshops = false

  // Estados de animación
  isTableAnimating = false
  showFilters = true

  // Variables para el control de permisos
  userRole: string | null = null
  isAdmin = false
  isUser = false

  constructor(
    private reportService: ReportService,
    private sanitizer: DomSanitizer,
    private activityService: ActivityService,
    private authService: AuthService,
  ) { }

  ngOnInit(): void {
    this.checkUserPermissions()
    this.loadReports()
  }

  /**
   * 🔒 Verificar permisos del usuario
   */
  private checkUserPermissions(): void {
    this.userRole = this.authService.getRole()
    this.isAdmin = this.authService.isAdminSync()
    this.isUser = this.authService.isUserSync()

    console.log("Rol del usuario:", this.userRole)
    console.log("Es admin:", this.isAdmin)
    console.log("Es user:", this.isUser)
  }

  /**
   * 🚫 Verificar si el usuario puede realizar operaciones de escritura
   */
  private canPerformWriteOperation(): boolean {
    return this.authService.canWrite()
  }

  /**
   * ⚠️ Mostrar mensaje de permisos insuficientes
   */
  private showPermissionDeniedAlert(): void {
    Swal.fire({
      title: "⚠️ Acceso Restringido",
      text: "No puedes realizar esta función. Estás en modo usuario, solo puedes ver la información.",
      icon: "warning",
      confirmButtonText: "Entendido",
      confirmButtonColor: "#f59e0b",
      backdrop: true,
      allowOutsideClick: false,
      customClass: {
        popup: "swal2-popup-custom",
      },
    })
  }

  loadReports(): void {
    this.isLoading = true
    this.isTableAnimating = true

    this.reportService.listReportsByFilter().subscribe(
      (data) => {
        setTimeout(() => {
          // Simular un pequeño delay para mostrar la animación
          this.reports = data
          this.extractYearsFromReports()
          this.filterReports()
          this.isLoading = false
          this.isTableAnimating = false
        }, 300)
      },
      (error) => {
        this.isLoading = false
        this.isTableAnimating = false
        Swal.fire({
          title: "Error",
          text: "No se pudieron cargar los reportes",
          icon: "error",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 3000,
        })
      },
    )
  }

  getPlainTextFromHtml(html: string, maxLength = 100): string {
    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = html || ""
    const text = tempDiv.textContent || tempDiv.innerText || ""
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text
  }

  async openDescriptionModal(descriptionUrl: string): Promise<void> {
    if (!descriptionUrl || descriptionUrl.trim() === "") {
      Swal.fire({
        title: "Sin descripción",
        text: "Este reporte no tiene descripción disponible",
        icon: "info",
        confirmButtonText: "Aceptar",
        toast: true,
        position: "top-end",
        timer: 3000,
        showConfirmButton: false,
      })
      return
    }

    this.isLoadingDescription = true
    this.showDescriptionModal = true
    this.descriptionHtml = this.sanitizer.bypassSecurityTrustHtml(
      '<div class="text-center py-8"><div class="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-blue-600 rounded-full" role="status" aria-label="loading"></div><p class="mt-2 text-gray-600 dark:text-gray-400">Cargando descripción...</p></div>',
    )

    try {
      console.log("🔄 Cargando contenido HTML desde:", descriptionUrl)

      const response = await fetch(descriptionUrl, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      })

      if (response.ok) {
        const htmlContent = await response.text()
        console.log("✅ Contenido HTML cargado exitosamente")

        if (htmlContent && htmlContent.trim() !== "") {
          this.descriptionHtml = this.sanitizer.bypassSecurityTrustHtml(htmlContent)
        } else {
          this.descriptionHtml = this.sanitizer.bypassSecurityTrustHtml(
            '<div class="text-center py-8 text-gray-500 dark:text-gray-400"><p>El archivo de descripción está vacío</p></div>',
          )
        }
      } else {
        console.error("❌ Error al cargar HTML:", response.status, response.statusText)
        this.descriptionHtml = this.sanitizer.bypassSecurityTrustHtml(`
          <div class="text-center py-8 text-red-500">
            <svg class="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="font-medium">Error al cargar la descripción</p>
            <p class="text-sm mt-1">Código de error: ${response.status}</p>
          </div>
        `)
      }
    } catch (error) {
      console.error("❌ Error al cargar contenido HTML:", error)
      this.descriptionHtml = this.sanitizer.bypassSecurityTrustHtml(`
        <div class="text-center py-8 text-red-500">
          <svg class="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="font-medium">Error de conexión</p>
          <p class="text-sm mt-1">No se pudo cargar la descripción</p>
        </div>
      `)
    } finally {
      this.isLoadingDescription = false
    }
  }

  closeDescriptionModal(): void {
    this.showDescriptionModal = false
  }

  extractYearsFromReports(): void {
    const uniqueYears = new Set<number>()

    this.reports.forEach((reportData) => {
      const year = "year" in reportData ? reportData.year : "report" in reportData ? reportData.report.year : undefined

      if (year) uniqueYears.add(year)
    })

    this.years = Array.from(uniqueYears).sort((a, b) => b - a)
  }

  filterReports(): void {
    this.isFilterLoading = true
    this.isTableAnimating = true

    const activeValue = this.activeFilter === "active" ? "A" : "I"
    const yearValue = this.selectedYear ? Number(this.selectedYear) : undefined

    this.reportService
      .listReportsByFilter(this.selectedTrimester, activeValue, yearValue, this.workshopDateStart, this.workshopDateEnd)
      .subscribe(
        (data) => {
          setTimeout(() => {
            // Pequeño delay para mostrar la animación
            this.filteredReports = data
            this.totalPages = Math.ceil(this.filteredReports.length / this.pageSize)
            this.currentPage = 1
            this.updatePagedReports()
            this.isFilterLoading = false
            this.isTableAnimating = false
          }, 400)
        },
        (error) => {
          this.isFilterLoading = false
          this.isTableAnimating = false
          Swal.fire({
            title: "Error",
            text: "No se pudieron filtrar los reportes",
            icon: "error",
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 3000,
          })
        },
      )
  }

  updatePagedReports(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize
    const endIndex = startIndex + this.pageSize
    this.pagedReports = this.filteredReports.slice(startIndex, endIndex)
  }

  clearAllFilters(): void {
    this.selectedTrimester = ""
    this.selectedYear = ""
    this.workshopDateStart = ""
    this.workshopDateEnd = ""
    this.activeFilter = "active"
    this.loadReports()
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters
  }

  // Métodos de paginación
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--
      this.updatePagedReports()
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++
      this.updatePagedReports()
    }
  }

  goToPage(page: number): void {
    this.currentPage = page
    this.updatePagedReports()
  }

  getPageNumbers(): number[] {
    const pageNumbers: number[] = []
    const maxVisiblePages = 5

    if (this.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2))
      let endPage = startPage + maxVisiblePages - 1

      if (endPage > this.totalPages) {
        endPage = this.totalPages
        startPage = Math.max(1, endPage - maxVisiblePages + 1)
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i)
      }
    }

    return pageNumbers
  }

  // Métodos para los filtros
  setActiveFilter(filter: "active" | "inactive"): void {
    this.activeFilter = filter
    this.filterReports()
  }

  refreshReports(): void {
    this.filterReports()
  }

  // Acciones de reporte
  viewReport(reportData: ReportDto | ReportWithWorkshopsDto): void {
    // Los usuarios pueden ver reportes (operación GET)
    this.isLoading = true
    const reportId = "report" in reportData ? reportData.report.id : reportData.id

    this.reportService.getReportByIdWithDateFilter(reportId, this.workshopDateStart, this.workshopDateEnd).subscribe(
      (detailedReport: ReportWithWorkshopsDto) => {
        this.selectedReport = detailedReport
        this.showReportViewer = true
        this.isLoading = false
      },
      (error) => {
        this.isLoading = false
        Swal.fire({
          title: "Error",
          text: "No se pudieron cargar los detalles del reporte",
          icon: "error",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 3000,
        })
      },
    )
  }

  closeReportViewer(): void {
    this.showReportViewer = false
    this.selectedReport = null
  }

  editReport(reportData: ReportDto | ReportWithWorkshopsDto): void {
    // 🔒 Verificar permisos antes de editar
    if (!this.canPerformWriteOperation()) {
      this.showPermissionDeniedAlert()
      return
    }

    this.isLoading = true
    const reportId = "report" in reportData ? reportData.report.id : reportData.id

    Swal.fire({
      title: "Cargando datos",
      text: "Por favor espere...",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading()
      },
    })

    this.reportService.getReportByIdWithDateFilter(reportId, this.workshopDateStart, this.workshopDateEnd).subscribe(
      (detailedReport: ReportWithWorkshopsDto) => {
        this.selectedReport = detailedReport
        this.showReportForm = true
        this.isLoading = false
        Swal.close()
      },
      (error) => {
        this.isLoading = false
        Swal.fire({
          title: "Error",
          text: "No se pudieron cargar los detalles del reporte",
          icon: "error",
        })
      },
    )
  }

  createReport(): void {
    // 🔒 Verificar permisos antes de crear
    if (!this.canPerformWriteOperation()) {
      this.showPermissionDeniedAlert()
      return
    }

    this.selectedReport = null
    this.showReportForm = true
  }

  closeReportForm(): void {
    this.showReportForm = false
    this.selectedReport = null
  }

  onReportSaved(report: ReportWithWorkshopsDto): void {
    const isNewReport = (() => {
      if (!this.selectedReport) return true
      if ("report" in this.selectedReport) {
        return !this.selectedReport.report?.id
      }
      return !this.selectedReport.id
    })()

    if (isNewReport) {
      this.logReportActivity("creó", report)
    } else {
      this.logReportActivity("editó", report)
    }

    Swal.fire({
      title: "¡Éxito!",
      text: "El reporte ha sido guardado correctamente",
      icon: "success",
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 3000,
    })

    this.filterReports()
  }

  deleteReport(reportData: ReportDto | ReportWithWorkshopsDto): void {
    // 🔒 Verificar permisos antes de eliminar
    if (!this.canPerformWriteOperation()) {
      this.showPermissionDeniedAlert()
      return
    }

    const report = "report" in reportData ? reportData.report : reportData

    Swal.fire({
      title: "¿Estás seguro?",
      text: `¿Deseas eliminar el reporte del ${report.trimester} ${report.year}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true
        this.reportService.deleteReport(report.id).subscribe(
          () => {
            this.logReportActivity("eliminó", reportData)
            this.isLoading = false
            Swal.fire({
              title: "¡Eliminado!",
              text: "El reporte ha sido eliminado correctamente.",
              icon: "success",
              toast: true,
              position: "top-end",
              showConfirmButton: false,
              timer: 3000,
            })
            this.filterReports()
          },
          (error) => {
            this.isLoading = false
            Swal.fire("Error", "No se pudo eliminar el reporte.", "error")
          },
        )
      }
    })
  }

  deleteReportPermanently(reportData: ReportDto | ReportWithWorkshopsDto): void {
    // 🔒 Verificar permisos antes de eliminar permanentemente
    if (!this.canPerformWriteOperation()) {
      this.showPermissionDeniedAlert()
      return
    }

    const report = "report" in reportData ? reportData.report : reportData

    Swal.fire({
      title: "¿Estás completamente seguro?",
      text: `Esta acción eliminará PERMANENTEMENTE el reporte del ${report.trimester} ${report.year}. No se podrá recuperar.`,
      icon: "error",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar permanentemente",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true
        this.reportService.deleteReportPermanently(report.id).subscribe(
          () => {
            this.logReportActivity("eliminó permanentemente", reportData)
            this.isLoading = false
            Swal.fire({
              title: "¡Eliminado permanentemente!",
              text: "El reporte ha sido eliminado de forma permanente.",
              icon: "success",
              toast: true,
              position: "top-end",
              showConfirmButton: false,
              timer: 3000,
            })
            this.filterReports()
          },
          (error) => {
            this.isLoading = false
            Swal.fire("Error", "No se pudo eliminar el reporte permanentemente.", "error")
          },
        )
      }
    })
  }

  restoreReport(reportData: any): void {
    // 🔒 Verificar permisos antes de restaurar
    if (!this.canPerformWriteOperation()) {
      this.showPermissionDeniedAlert()
      return
    }

    const report = reportData.report || reportData

    Swal.fire({
      title: "¿Estás seguro?",
      text: `¿Deseas restaurar el reporte del ${report.trimester} ${report.year}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, restaurar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true
        this.reportService.restoreReport(report.id).subscribe(
          () => {
            this.logReportActivity("restauró", reportData)
            this.isLoading = false
            Swal.fire({
              title: "¡Restaurado!",
              text: "El reporte ha sido restaurado correctamente.",
              icon: "success",
              toast: true,
              position: "top-end",
              showConfirmButton: false,
              timer: 3000,
            })
            this.filterReports()
          },
          (error) => {
            this.isLoading = false
            Swal.fire("Error", "No se pudo restaurar el reporte.", "error")
          },
        )
      }
    })
  }

  private logReportActivity(action: string, reportData: ReportDto | ReportWithWorkshopsDto): void {
    this.authService.getLoggedUserInfo().subscribe({
      next: (currentUser) => {
        const report = "report" in reportData ? reportData.report : reportData

        const activity = {
          imagen: currentUser?.profileImage || "/placeholder.svg?height=40&width=40",
          nombre: `${currentUser?.name || ""} ${currentUser?.lastName || ""}`.trim() || currentUser?.email || "Usuario",
          modulo: "Reportes",
          accion: `${action} el reporte del trimestre ${report.trimester} ${report.year}`,
        }

        this.activityService.logActivity(activity)
        console.log(`Actividad registrada: ${action} reporte ${report.trimester} ${report.year}`)
      },
      error: () => {
        const report = "report" in reportData ? reportData.report : reportData

        const activity = {
          imagen: "/placeholder.svg?height=40&width=40",
          nombre: "Usuario del sistema",
          modulo: "Reportes",
          accion: `${action} el reporte del trimestre ${report.trimester} ${report.year}`,
        }

        this.activityService.logActivity(activity)
        console.log(`Actividad registrada (fallback): ${action} reporte ${report.trimester} ${report.year}`)
      },
    })
  }

  downloadPdf(reportData: any): void {
    // Los usuarios pueden descargar PDFs (operación GET)
    const reportId = "report" in reportData ? reportData.report.id : reportData.id

    Swal.fire({
      title: "Generando PDF...",
      text: "Por favor espera un momento",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading()
      },
    })

    this.reportService.downloadReportPdf(reportId, this.workshopDateStart, this.workshopDateEnd).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.target = "_blank"
        a.download = `reporte_${reportId}.pdf`
        a.click()
        window.URL.revokeObjectURL(url)

        Swal.close()
        Swal.fire({
          title: "¡Descarga completada!",
          text: "El PDF se ha descargado correctamente",
          icon: "success",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 3000,
        })
      },
      error: (error) => {
        Swal.fire("Error", "No se pudo generar el PDF.", "error")
      },
    })
  }

  // Métodos para el visor de imágenes
  viewWorkshopImages(workshops: any): void {
    if (workshops.imageUrl && workshops.imageUrl.length > 0) {
      this.currentImages = workshops.imageUrl.map((url: string) => {
        if (url.startsWith("http")) {
          return url
        } else if (url.startsWith("data:image")) {
          return url
        } else if (url.startsWith("iVBOR") || url.startsWith("ASUN") || url.includes("/9j/") || url.includes("+/9k=")) {
          return `data:image/png;base64,${url}`
        } else {
          return "/assets/placeholder-image.png"
        }
      })

      this.currentImageIndex = 0
      this.showImageViewer = true
    } else {
      Swal.fire({
        title: "Información",
        text: "Este taller no tiene imágenes",
        icon: "info",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
      })
    }
  }

  viewWorkshops(reportData: any): void {
    const reportId = reportData.report ? reportData.report.id : reportData.id

    Swal.fire({
      title: "Cargando talleres",
      text: "Por favor espere...",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading()
      },
    })

    this.loadingWorkshops = true

    this.reportService.getReportByIdWithDateFilter(reportId, this.workshopDateStart, this.workshopDateEnd).subscribe(
      (detailedReport) => {
        this.processWorkshopsFromReport(detailedReport)
      },
      (error) => {
        this.handleWorkshopLoadError(error)
      },
    )
  }

  loadWorkshopsWithImages(workshops: any[]): void {
    const reportId = workshops[0].reportId

    this.reportService.getReportByIdWithDateFilter(reportId, this.workshopDateStart, this.workshopDateEnd).subscribe(
      (detailedReport) => {
        this.processWorkshopsFromReport(detailedReport)
      },
      (error) => {
        this.handleWorkshopLoadError(error)
      },
    )
  }

  private processWorkshopsFromReport(detailedReport: any): void {
    let detailedWorkshops = []

    if (detailedReport.workshops && Array.isArray(detailedReport.workshops)) {
      detailedWorkshops = detailedReport.workshops
    } else if (
      detailedReport.report &&
      detailedReport.report.workshops &&
      Array.isArray(detailedReport.report.workshops)
    ) {
      detailedWorkshops = detailedReport.report.workshops
    }

    this.currentWorkshops = detailedWorkshops
    this.currentWorkshopIndex = 0
    this.showWorkshopViewer = true
    this.loadingWorkshops = false
    Swal.close()
  }

  private handleWorkshopLoadError(error: any): void {
    this.loadingWorkshops = false
    Swal.fire({
      title: "Error",
      text: "No se pudieron cargar los detalles de los talleres",
      icon: "error",
      confirmButtonText: "Aceptar",
    })
  }

  filterWorkshopsByDate(workshops: any[]): any[] {
    if (!workshops || workshops.length === 0) {
      return []
    }

    return workshops.filter((workshops) => {
      const workshopStartDate = new Date(workshops.workshopDateStart)
      const workshopEndDate = new Date(workshops.workshopDateEnd)

      const filterStartDate = this.workshopDateStart ? new Date(this.workshopDateStart) : null
      const filterEndDate = this.workshopDateEnd ? new Date(this.workshopDateEnd) : null

      if (filterStartDate && !filterEndDate) {
        return workshopStartDate >= filterStartDate
      } else if (!filterStartDate && filterEndDate) {
        return workshopEndDate <= filterEndDate
      } else if (filterStartDate && filterEndDate) {
        return (
          (workshopStartDate >= filterStartDate && workshopStartDate <= filterEndDate) ||
          (workshopEndDate >= filterStartDate && workshopEndDate <= filterEndDate) ||
          (workshopStartDate <= filterStartDate && workshopEndDate >= filterEndDate)
        )
      }

      return true
    })
  }

  viewCurrentWorkshopImages(): void {
    const currentWorkshop = this.currentWorkshops[this.currentWorkshopIndex]
    if (currentWorkshop && currentWorkshop.imageUrl && currentWorkshop.imageUrl.length > 0) {
      this.currentImages = currentWorkshop.imageUrl.map((url: string) => {
        if (url.startsWith("http")) {
          return url
        } else if (url.startsWith("data:image")) {
          return url
        } else if (url.startsWith("iVBOR") || url.startsWith("ASUN") || url.includes("/9j/") || url.includes("+/9k=")) {
          return `data:image/png;base64,${url}`
        } else {
          return "/assets/placeholder-image.png"
        }
      })

      this.currentImageIndex = 0

      setTimeout(() => {
        this.showImageViewer = true
      }, 0)
    } else {
      Swal.fire({
        title: "Información",
        text: "Este taller no tiene imágenes",
        icon: "info",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
      })
    }
  }

  closeWorkshopViewer(): void {
    this.showWorkshopViewer = false
  }

  prevWorkshop(): void {
    if (this.currentWorkshopIndex > 0) {
      this.currentWorkshopIndex--
    }
  }

  nextWorkshop(): void {
    if (this.currentWorkshopIndex < this.currentWorkshops.length - 1) {
      this.currentWorkshopIndex++
    }
  }

  closeImageViewer(): void {
    this.showImageViewer = false
  }

  prevImage(): void {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--
    }
  }

  nextImage(): void {
    if (this.currentImageIndex < this.currentImages.length - 1) {
      this.currentImageIndex++
    }
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return "Fecha no disponible"

    const date = new Date(dateString)
    const day = date.getDate() + 1
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  getSafeReport(report: ReportDto | ReportWithWorkshopsDto): ReportDto {
    return "report" in report ? report.report : report
  }

  getReportStatus(report: ReportDto | ReportWithWorkshopsDto): string {
    return "report" in report ? report.report.status : report.status
  }

  getWorkshopsCount(report: ReportDto | ReportWithWorkshopsDto): number {
    if ("workshops" in report && report.workshops) return report.workshops.length
    if ("report" in report && (report as any).report.workshops) return (report as any).report.workshops.length
    return 0
  }

  hasWorkshops(report: ReportDto | ReportWithWorkshopsDto): boolean {
    return this.getWorkshopsCount(report) > 0
  }

  /**
   * 🔒 Getter para saber si puede mostrar botones de escritura en el template
   */
  get canShowWriteButtons(): boolean {
    return this.canPerformWriteOperation()
  }
}
