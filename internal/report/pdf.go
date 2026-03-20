package report

import (
	"bytes"
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
)

//go:embed assets/logo.png
var logoPNG []byte

//go:embed assets/logo-inverted.png
var logoInvertedPNG []byte

const (
	pageW    = 210.0 // A4 width mm
	pageH    = 297.0 // A4 height mm
	marginL  = 15.0
	marginR  = 15.0
	marginT  = 20.0
	marginB  = 20.0
	contentW = pageW - marginL - marginR
	lineH    = 5.0
)

// PDFReport holds data for generating a branded PDF report.
type PDFReport struct {
	Title       string
	Subtitle    string
	Sections    []PDFSection
	Metadata    map[string]string
	GeneratedAt time.Time
	Model       string
	Provider    string
}

// PDFSection represents a section in the PDF report.
type PDFSection struct {
	Heading string
	Body    string
	Table   *PDFTable
}

// PDFTable holds tabular data for the report.
type PDFTable struct {
	Headers []string
	Rows    [][]string
	ColW    []float64
}

// GeneratePDF creates a branded PDF with "Tessera Agent" watermark.
func GeneratePDF(r *PDFReport) (string, error) {
	if r.GeneratedAt.IsZero() {
		r.GeneratedAt = time.Now()
	}

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, marginB+15)
	pdf.SetMargins(marginL, marginT+15, marginR)

	// Register embedded logo images
	pdf.RegisterImageOptionsReader("logo", fpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(logoPNG))
	pdf.RegisterImageOptionsReader("logo-inv", fpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(logoInvertedPNG))

	// Brand colors: #0C447C (dark), #185FA5 (mid), #378ADD (bright)
	// Header on every page
	pdf.SetHeaderFuncMode(func() {
		// Dark blue header bar background
		pdf.SetFillColor(12, 68, 124) // #0C447C
		pdf.Rect(0, 0, pageW, 14, "F")

		// Inverted logo in header (white on dark blue)
		pdf.ImageOptions("logo-inv", marginL, 1.5, 11, 11, false, fpdf.ImageOptions{ImageType: "PNG"}, 0, "")

		pdf.SetY(4)
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetTextColor(255, 255, 255)
		pdf.SetX(marginL + 12)
		pdf.CellFormat(contentW/2-12, 6, "TESSERA", "", 0, "L", false, 0, "")
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(200, 220, 240)
		pdf.CellFormat(contentW/2, 6, r.GeneratedAt.Format("2006-01-02 15:04 UTC"), "", 1, "R", false, 0, "")

		// Bright blue accent line below header
		pdf.SetDrawColor(55, 138, 221) // #378ADD
		pdf.SetLineWidth(0.6)
		pdf.Line(marginL, 14.5, pageW-marginR, 14.5)

		// Watermark on every page
		pdf.SetFont("Helvetica", "B", 54)
		pdf.SetTextColor(55, 138, 221) // #378ADD
		pdf.SetAlpha(0.08, "Normal")
		cx, cy := pageW/2, pageH/2
		pdf.TransformBegin()
		pdf.TransformRotate(-35, cx, cy)
		pdf.SetXY(cx-85, cy-12)
		pdf.CellFormat(170, 24, "Tessera", "", 0, "C", false, 0, "")
		pdf.TransformEnd()
		pdf.SetAlpha(1.0, "Normal")
	}, true)

	// Footer on every page
	pdf.SetFooterFunc(func() {
		pdf.SetY(-14)
		pdf.SetDrawColor(24, 95, 165) // #185FA5
		pdf.SetLineWidth(0.3)
		pdf.Line(marginL, pdf.GetY(), pageW-marginR, pdf.GetY())
		pdf.Ln(1.5)

		// Small logo in footer
		footerY := pdf.GetY()
		pdf.ImageOptions("logo", marginL, footerY, 4, 4, false, fpdf.ImageOptions{ImageType: "PNG"}, 0, "")
		pdf.SetX(marginL + 5)
		pdf.SetFont("Helvetica", "", 7)
		pdf.SetTextColor(12, 68, 124) // #0C447C
		pdf.CellFormat(contentW*0.6-5, 4, "Tessera | AI-Powered Public Goods Evaluation", "", 0, "L", false, 0, "")
		pdf.SetTextColor(100, 100, 100)
		pdf.CellFormat(contentW*0.4, 4, fmt.Sprintf("Page %d | %s/%s", pdf.PageNo(), r.Provider, r.Model), "", 0, "R", false, 0, "")
	})

	pdf.AddPage()

	// Centered logo above title
	logoSize := 18.0
	pdf.ImageOptions("logo", marginL+(contentW-logoSize)/2, pdf.GetY(), logoSize, logoSize, false, fpdf.ImageOptions{ImageType: "PNG"}, 0, "")
	pdf.SetY(pdf.GetY() + logoSize + 3)

	// Title
	pdf.SetFont("Helvetica", "B", 18)
	pdf.SetTextColor(12, 68, 124) // #0C447C
	pdf.MultiCell(contentW, 8, sanitize(r.Title), "", "C", false)

	if r.Subtitle != "" {
		pdf.SetFont("Helvetica", "", 10)
		pdf.SetTextColor(24, 95, 165) // #185FA5
		pdf.CellFormat(contentW, 6, sanitize(r.Subtitle), "", 1, "C", false, 0, "")
	}
	pdf.Ln(4)

	// Metadata box
	if len(r.Metadata) > 0 {
		keys := sortedKeys(r.Metadata)
		pdf.SetFillColor(235, 243, 252) // light brand blue tint
		startY := pdf.GetY()
		boxH := float64(len(keys))*lineH + 6
		pdf.RoundedRect(marginL, startY, contentW, boxH, 2, "1234", "F")
		pdf.SetXY(marginL+4, startY+3)
		for _, k := range keys {
			pdf.SetFont("Helvetica", "B", 9)
			pdf.SetTextColor(51, 51, 51)
			pdf.CellFormat(42, lineH, sanitize(k+":"), "", 0, "L", false, 0, "")
			pdf.SetFont("Helvetica", "", 9)
			pdf.CellFormat(contentW-48, lineH, sanitize(r.Metadata[k]), "", 1, "L", false, 0, "")
			pdf.SetX(marginL + 4)
		}
		pdf.SetY(startY + boxH + 4)
	}

	// Sections
	for _, sec := range r.Sections {
		// Section heading
		pdf.SetFont("Helvetica", "B", 12)
		pdf.SetTextColor(12, 68, 124) // #0C447C
		pdf.CellFormat(contentW, 8, sanitize(sec.Heading), "", 1, "L", false, 0, "")
		y := pdf.GetY()
		pdf.SetDrawColor(55, 138, 221) // #378ADD
		pdf.SetLineWidth(0.4)
		pdf.Line(marginL, y, pageW-marginR, y)
		pdf.Ln(2)

		// Table
		if sec.Table != nil {
			drawTableV2(pdf, sec.Table)
			pdf.Ln(4)
		}

		// Body
		if sec.Body != "" {
			writeBodyV2(pdf, sec.Body)
			pdf.Ln(3)
		}
	}

	// Save
	os.MkdirAll("reports", 0o755)
	safe := strings.Map(func(r rune) rune {
		if r == ' ' || r == '/' || r == ':' {
			return '_'
		}
		return r
	}, strings.ToLower(r.Title))
	if len(safe) > 40 {
		safe = safe[:40]
	}
	ts := r.GeneratedAt.Format("20060102_150405")
	path := filepath.Join("reports", fmt.Sprintf("%s_%s.pdf", safe, ts))

	err := pdf.OutputFileAndClose(path)
	if err != nil {
		return "", fmt.Errorf("failed to write PDF: %w", err)
	}
	return path, nil
}

func drawTableV2(pdf *fpdf.Fpdf, t *PDFTable) {
	if len(t.Headers) == 0 {
		return
	}
	colW := t.ColW
	if len(colW) != len(t.Headers) {
		w := contentW / float64(len(t.Headers))
		colW = make([]float64, len(t.Headers))
		for i := range colW {
			colW[i] = w
		}
	}

	// Header
	pdf.SetFillColor(12, 68, 124) // #0C447C
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Helvetica", "B", 8)
	for i, h := range t.Headers {
		pdf.CellFormat(colW[i], 6, sanitize(h), "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	// Rows
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(51, 51, 51)
	for ri, row := range t.Rows {
		if ri%2 == 0 {
			pdf.SetFillColor(245, 247, 250)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}
		for i, cell := range row {
			if i < len(colW) {
				pdf.CellFormat(colW[i], 5.5, sanitize(cell), "1", 0, "L", true, 0, "")
			}
		}
		pdf.Ln(-1)
	}
}

func writeBodyV2(pdf *fpdf.Fpdf, text string) {
	lines := strings.Split(text, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		cleaned := sanitize(stripMarkdown(line))

		switch {
		case line == "":
			pdf.Ln(2)

		case strings.HasPrefix(line, "### "):
			pdf.SetFont("Helvetica", "B", 10)
			pdf.SetTextColor(24, 95, 165) // #185FA5
			pdf.CellFormat(contentW, 6, sanitize(stripMarkdown(strings.TrimPrefix(line, "### "))), "", 1, "L", false, 0, "")

		case strings.HasPrefix(line, "## "):
			pdf.SetFont("Helvetica", "B", 11)
			pdf.SetTextColor(12, 68, 124) // #0C447C
			pdf.CellFormat(contentW, 7, sanitize(stripMarkdown(strings.TrimPrefix(line, "## "))), "", 1, "L", false, 0, "")

		case strings.HasPrefix(line, "# "):
			pdf.SetFont("Helvetica", "B", 13)
			pdf.SetTextColor(12, 68, 124) // #0C447C
			pdf.CellFormat(contentW, 8, sanitize(stripMarkdown(strings.TrimPrefix(line, "# "))), "", 1, "L", false, 0, "")

		case strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* "):
			bullet := strings.TrimPrefix(strings.TrimPrefix(line, "- "), "* ")
			bullet = sanitize(stripMarkdown(bullet))
			pdf.SetFont("Helvetica", "", 8)
			pdf.SetTextColor(51, 51, 51)
			pdf.SetX(marginL + 4)
			pdf.CellFormat(4, lineH, "-", "", 0, "L", false, 0, "")
			pdf.MultiCell(contentW-8, lineH, bullet, "", "L", false)

		case strings.HasPrefix(line, "|") && strings.Contains(line, "|"):
			// Markdown table row — render as simple text
			cells := strings.Split(line, "|")
			var parts []string
			for _, c := range cells {
				c = strings.TrimSpace(c)
				if c != "" && !strings.HasPrefix(c, "---") {
					parts = append(parts, c)
				}
			}
			if len(parts) > 0 && !strings.HasPrefix(parts[0], "---") {
				pdf.SetFont("Helvetica", "", 7)
				pdf.SetTextColor(80, 80, 80)
				row := strings.Join(parts, "  |  ")
				pdf.MultiCell(contentW, 4, sanitize(stripMarkdown(row)), "", "L", false)
			}

		case strings.HasPrefix(line, "---"):
			y := pdf.GetY() + 1
			pdf.SetDrawColor(200, 200, 200)
			pdf.SetLineWidth(0.2)
			pdf.Line(marginL, y, pageW-marginR, y)
			pdf.SetY(y + 2)

		default:
			pdf.SetFont("Helvetica", "", 8)
			pdf.SetTextColor(51, 51, 51)
			pdf.MultiCell(contentW, lineH, cleaned, "", "L", false)
		}
	}
}

// sanitize replaces Unicode chars that fpdf can't render with ASCII equivalents.
func sanitize(s string) string {
	r := strings.NewReplacer(
		"\u2014", "--",    // em dash
		"\u2013", "-",     // en dash
		"\u2192", "->",    // arrow
		"\u2190", "<-",    // left arrow
		"\u2022", "-",     // bullet
		"\u2018", "'",     // left single quote
		"\u2019", "'",     // right single quote
		"\u201c", "\"",    // left double quote
		"\u201d", "\"",    // right double quote
		"\u2026", "...",   // ellipsis
		"\u00a0", " ",     // non-breaking space
		"\u2264", "<=",    // less-equal
		"\u2265", ">=",    // greater-equal
		"\u00d7", "x",     // multiplication
		"\u2212", "-",     // minus
		"\u2248", "~",     // approximately
		"\u2260", "!=",    // not equal
		"\u03b1", "alpha", // alpha
		"\u03b2", "beta",  // beta
		"\u221e", "inf",   // infinity
	)
	return r.Replace(s)
}

func stripMarkdown(s string) string {
	s = strings.ReplaceAll(s, "**", "")
	s = strings.ReplaceAll(s, "__", "")
	s = strings.ReplaceAll(s, "`", "")
	return s
}

func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	for i := 1; i < len(keys); i++ {
		j := i
		for j > 0 && keys[j] < keys[j-1] {
			keys[j], keys[j-1] = keys[j-1], keys[j]
			j--
		}
	}
	return keys
}
